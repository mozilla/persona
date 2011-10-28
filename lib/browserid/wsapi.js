/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla BrowserID.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

// a module which implements the authorities web server api.
// it used to be that we stuffed every function in exports.
// now we're using proper express function registration to deal
// with HTTP methods and the like, apply middleware, etc.

const
db = require('db.js'),
url = require('url'),
httputils = require('httputils.js'),
email = require('./email.js'),
bcrypt = require('bcrypt'),
crypto = require('crypto'),
logger = require('logging.js').logger,
ca = require('./ca.js'),
configuration = require('configuration.js');

function checkParams(params) {
  return function(req, resp, next) {
    var params_in_request=null;
    if (req.method === "POST") {
      params_in_request = req.body;
    } else {
      params_in_request = req.query;
    }

    try {
      params.forEach(function(k) {
        if (!params_in_request.hasOwnProperty(k) || typeof params_in_request[k] !== 'string') {
          throw k;
        }
      });
    } catch(e) {
      logger.error(e.toString());
      return httputils.badRequest(resp, "missing '" + e + "' argument");
    }
    next();
  };
}

// log a user out, clearing everything from their session except the csrf token
function clearAuthenticatedUser(session) {
  Object.keys(session).forEach(function(k) {
    if (k !== 'csrf') delete session[k];
  });
}


function setAuthenticatedUser(session, email) {
  session.authenticatedUser = email;
  session.authenticatedAt = new Date();
}

function isAuthed(req) {
  var who;
  try {
    if (req.session.authenticatedUser) {
      if (!Date.parse(req.session.authenticatedAt) > 0) throw "bad timestamp";
      if (new Date() - new Date(req.session.authenticatedAt) >
          configuration.get('authentication_duration_ms'))
      {
        throw "expired";
      }
      who = req.session.authenticatedUser;
    }
  } catch(e) {
    logger.debug("Session authentication has expired:", e);
    clearAuthenticatedUser(req.session);
  }

  return who;
}

// turned this into a proper middleware
function checkAuthed(req, resp, next) {
  if (!isAuthed(req)) {
    return httputils.badRequest(resp, "requires authentication");
  }

  next();
}

function setup(app) {
  // return the CSRF token, authentication status, and current server time (for assertion signing)
  // IMPORTANT: this is safe because it's only readable by same-origin code
  app.get('/wsapi/session_context', function(req, res) {
    if (typeof req.session == 'undefined') {
      req.session = {};
    }

    if (typeof req.session.csrf == 'undefined') {
      // FIXME: using express-csrf's approach for generating randomness
      // not awesome, but probably sufficient for now.
      req.session.csrf = crypto.createHash('md5').update('' + new Date().getTime()).digest('hex');
      logger.debug("NEW csrf token created: " + req.session.csrf);
    }

    var auth_status = false;

    function sendResponse() {
      res.json({
        csrf_token: req.session.csrf,
        server_time: (new Date()).getTime(),
        authenticated: auth_status
      });
    };

    // if they're authenticated for an email address that we don't know about,
    // then we should purge the stored cookie
    if (!isAuthed(req)) {
      logger.debug("user is not authenticated");
      sendResponse();
    } else {
      db.emailKnown(req.session.authenticatedUser, function (known) {
        if (!known) {
          logger.debug("user is authenticated with an email that doesn't exist in the database");
          clearAuthenticatedUser(req.session);
        } else {
          logger.debug("user is authenticated");
          auth_status = true;
        }
        sendResponse();
      });
    }
  });

  /* checks to see if an email address is known to the server
   * takes 'email' as a GET argument */
  app.get('/wsapi/have_email', function(req, resp) {
    // get inputs from get data!
    var email = url.parse(req.url, true).query['email'];
    db.emailKnown(email, function(known) {
      resp.json({ email_known: known });
    });
  });

  /* First half of account creation.  Stages a user account for creation.
   * this involves creating a secret url that must be delivered to the
   * user via their claimed email address.  Upon timeout expiry OR clickthrough
   * the staged user account transitions to a valid user account
   */
  app.post('/wsapi/stage_user', checkParams([ "email", "site" ]), function(req, resp) {
    // staging a user logs you out.
    clearAuthenticatedUser(req.session);

    try {
      // upon success, stage_user returns a secret (that'll get baked into a url
      // and given to the user), on failure it throws
      db.stageUser(req.body.email, function(secret) {
        // store the email being registered in the session data
        if (!req.session) req.session = {};

        // store the secret we're sending via email in the users session, as checking
        // that it still exists in the database is the surest way to determine the
        // status of the email verification.
        req.session.pendingCreation = secret;

        resp.json({ success: true });

        // let's now kick out a verification email!
        email.sendNewUserEmail(req.body.email, req.body.site, secret);
      });
    } catch(e) {
      // we should differentiate tween' 400 and 500 here.
      httputils.badRequest(resp, e.toString());
    }
  });

  app.get('/wsapi/user_creation_status', function(req, resp) {
    var email = req.query.email;
    if (typeof email !== 'string') {
      logger.warn("user_creation_status called without 'email' parameter");
      httputils.badRequest(resp, "no 'email' parameter");
      return;
    }

    // if the user is authenticated as the user in question, we're done
    if (isAuthed(req) && req.session.authenticatedUser === email) {
      return resp.json({ status: 'complete' });
    }
    // if the user isn't authenticated and there's no pendingCreation token,
    // then they must authenticate
    else if (!req.session.pendingCreation) {
      return resp.json({ status: 'mustAuth' });
    }

    // if the secret is still in the database, it hasn't yet been verified and
    // verification is still pending
    db.emailForVerificationSecret(req.session.pendingCreation, function (email) {
      if (email) return resp.json({ status: 'pending' });
      // if the secret isn't known, and we're not authenticated, then the user must authenticate
      // (maybe they verified the URL on a different browser, or maybe they canceled the account
      // creation)
      else {
        delete req.session.pendingCreation;
        resp.json({ status: 'mustAuth' });
      }
    });
  });

  function bcrypt_password(password, cb) {
    var bcryptWorkFactor = configuration.get('bcrypt_work_factor');

    bcrypt.gen_salt(bcryptWorkFactor, function (err, salt) {
      if (err) {
        var msg = "error generating salt with bcrypt: " + err;
        logger.error(msg);
        return cb(msg);
      }
      bcrypt.encrypt(password, salt, function(err, hash) {
        if (err) {
          var msg = "error generating password hash with bcrypt: " + err;
          logger.error(msg);
          return cb(msg);
        }
        return cb(undefined, hash);
      });
    });
  };

  app.post('/wsapi/complete_user_creation', checkParams(["token", "pass"]), function(req, resp) {
    // issue #155, valid password length is between 8 and 80 chars.
    if (req.body.pass.length < 8 || req.body.pass.length > 80) {
      httputils.badRequest(resp, "valid passwords are between 8 and 80 chars");
      return;
    }

    // at the time the email verification is performed, we'll clear the pendingCreation
    // data on the session.
    delete req.session.pendingCreation;

    // We should check to see if the verification secret is valid *before*
    // bcrypting the password (which is expensive), to prevent a possible
    // DoS attack.
    db.emailForVerificationSecret(req.body.token, function(email) {
      if (!email) return resp.json({ success: false} );

      // now bcrypt the password
      bcrypt_password(req.body.pass, function (err, hash) {
        if (err) {
          logger.error("can't bcrypt: " + err);
          return resp.json({ success: false });
        }

        db.gotVerificationSecret(req.body.token, hash, function(err, email) {
          if (err) {
            logger.warn("couldn't complete email verification: " + err);
            resp.json({ success: false });
          } else {
            // FIXME: not sure if we want to do this (ba)
            // at this point the user has set a password associated with an email address
            // that they've verified.  We create an authenticated session.
            setAuthenticatedUser(req.session, email);
            resp.json({ success: true });
          }
        });
      });
    });
  });

  app.post('/wsapi/stage_email', checkAuthed, checkParams(["email", "site"]), function (req, resp) {
    try {
      // on failure stageEmail may throw
      db.stageEmail(req.session.authenticatedUser, req.body.email, function(secret) {

        // store the email being added in session data
        req.session.pendingAddition = secret;

        resp.json({ success: true });

        // let's now kick out a verification email!
        email.sendAddAddressEmail(req.body.email, req.body.site, secret);
      });
    } catch(e) {
      // we should differentiate tween' 400 and 500 here.
      httputils.badRequest(resp, e.toString());
    }
  });

  app.get('/wsapi/email_for_token', checkParams(["token"]), function(req,resp) {
    db.emailForVerificationSecret(req.query.token, function(email) {
      resp.json({ email: email });
    });
  });

  app.get('/wsapi/email_addition_status', function(req, resp) {

    var email = req.query.email;
    if (typeof email !== 'string')
    {
      logger.warn("email_addition_status called without an 'email' parameter");
      httputils.badRequest(resp, "missing 'email' parameter");
      return;
    }

    // this is a pending email addition, it requires authentication
    if (!isAuthed(req, resp)) {
      delete req.session.pendingAddition;
      return httputils.badRequest(resp, "requires authentication");
    }

    // check if the currently authenticated user has the email stored under pendingAddition
    // in their acct.
    db.emailsBelongToSameAccount(
      email,
      req.session.authenticatedUser,
      function(registered) {
        if (registered) {
          delete req.session.pendingAddition;
          resp.json({ status: 'complete' });
        } else if (!req.session.pendingAddition) {
          resp.json('failed');
        } else {
          db.emailForVerificationSecret(req.session.pendingAddition, function (email) {
            if (email) {
              return resp.json({ status: 'pending' });
            } else {
              delete req.session.pendingAddition;
              resp.json({ status: 'failed' });
            }
          });
        }
      });
  });

  app.post('/wsapi/complete_email_addition', checkParams(["token"]), function(req, resp) {
    db.gotVerificationSecret(req.body.token, undefined, function(e) {
      if (e) {
        logger.warn("couldn't complete email verification: " + e);
        resp.json({ success: false });
      } else {
        resp.json({ success: true });
      }
    });
  });

  app.post('/wsapi/authenticate_user', checkParams(["email", "pass"]), function(req, resp) {
    db.checkAuth(req.body.email, function(hash) {
      if (typeof hash !== 'string' ||
          typeof req.body.pass !== 'string')
      {
        return resp.json({ success: false });
      }

      bcrypt.compare(req.body.pass, hash, function (err, success) {
        if (err) {
          logger.warn("error comparing passwords with bcrypt: " + err);
          success = false;
        }
        if (success) {
          if (!req.session) req.session = {};
          setAuthenticatedUser(req.session, req.body.email);

          // if the work factor has changed, update the hash here.  issue #204
          // NOTE: this runs asynchronously and will not delay the response
          if (configuration.get('bcrypt_work_factor') != bcrypt.get_rounds(hash)) {
            logger.info("updating bcrypted password for email " + req.body.email);
            bcrypt_password(req.body.pass, function(err, hash) {
              db.updatePassword(req.body.email, hash, function(err) {
                if (err) {
                  logger.error("error updating bcrypted password for email " + req.body.email, err);
                }
              });
            });
          }
        }
        resp.json({ success: success });
      });
    });
  });

  app.post('/wsapi/remove_email', checkAuthed, checkParams(["email"]), function(req, resp) {
    var email = req.body.email;

    db.removeEmail(req.session.authenticatedUser, email, function(error) {
      if (error) {
        logger.error("error removing email " + email);
        httputils.badRequest(resp, error.toString());
      } else {
        resp.json({ success: true });
      }});
  });

  app.post('/wsapi/account_cancel', checkAuthed, function(req, resp) {
    db.cancelAccount(req.session.authenticatedUser, function(error) {
      if (error) {
        logger.error("error cancelling account : " + error.toString());
        httputils.badRequest(resp, error.toString());
      } else {
        resp.json({ success: true });
      }});
  });

  app.post('/wsapi/cert_key', checkAuthed, checkParams(["email", "pubkey"]), function(req, resp) {
    db.emailsBelongToSameAccount(req.session.authenticatedUser, req.body.email, function(sameAccount) {
      // not same account? big fat error
      if (!sameAccount) return httputils.badRequest(resp, "that email does not belong to you");

      // parse the pubkey
      var pk = ca.parsePublicKey(req.body.pubkey);

      // same account, we certify the key
      // we certify it for a day for now
      var expiration = new Date();
      expiration.setTime(new Date().valueOf() + configuration.get('certificate_validity_ms'));
      var cert = ca.certify(req.body.email, pk, expiration);

      resp.writeHead(200, {'Content-Type': 'text/plain'});
      resp.write(cert);
      resp.end();
    });
  });

  app.post('/wsapi/logout', function(req, resp) {
    clearAuthenticatedUser(req.session);
    resp.json({ success: true });
  });

  // in the cert world, syncing is not necessary,
  // just get a list of emails.
  // returns:
  // {
  //   "foo@foo.com" : {..properties..}
  //   ...
  // }
  app.get('/wsapi/list_emails', checkAuthed, function(req, resp) {
    logger.debug('listing emails for ' + req.session.authenticatedUser);
    db.listEmails(req.session.authenticatedUser, function(err, emails) {
      if (err) httputils.serverError(resp, err);
      else resp.json(emails);
    });
  });

  // if the BROWSERID_FAKE_VERIFICATION env var is defined, we'll include
  // fake_verification.js.  This is used during testing only and should
  // never be included in a production deployment
  if (process.env['BROWSERID_FAKE_VERIFICATION']) {
    require('./fake_verification.js').addVerificationWSAPI(app);
  }
}

exports.setup = setup;
