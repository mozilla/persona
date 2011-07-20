// a module which implements the authorities web server api.
// it used to be that we stuffed every function in exports.
// now we're using proper express function registration to deal
// with HTTP methods and the like, apply middleware, etc.

const db = require('./db.js'),
      url = require('url'),
      httputils = require('./httputils.js');
      email = require('./email.js'),
      bcrypt = require('bcrypt');

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
      console.log("error : " + e.toString());
      return httputils.badRequest(resp, "missing '" + e + "' argument");
    }
    next();
  };
}

function isAuthed(req) {
  return (req.session && typeof req.session.authenticatedUser === 'string');
}

// turned this into a proper middleware
function checkAuthed(req, resp, next) {
  if (!isAuthed(req)) {
    return httputils.badRequest(resp, "requires authentication");
  }

  next();
}

function setup(app) {
  /* checks to see if an email address is known to the server
   * takes 'email' as a GET argument */
  app.get('/wsapi/have_email', function(req, resp) {
      // get inputs from get data!
      var email = url.parse(req.url, true).query['email'];
      db.emailKnown(email, function(known) {
          httputils.jsonResponse(resp, known);
        });
    });
  
  /* First half of account creation.  Stages a user account for creation.
   * this involves creating a secret url that must be delivered to the
   * user via their claimed email address.  Upon timeout expiry OR clickthrough
   * the staged user account transitions to a valid user account */
  app.get('/wsapi/stage_user', checkParams([ "email", "pass", "pubkey", "site" ]), function(req, resp) {
      
      // bcrypt the password
      // we should be cloning this object here.
      var stageParams = req.query;
      stageParams['hash'] = bcrypt.encrypt_sync(req.query.pass, bcrypt.gen_salt_sync(10));
        
      try {
        // upon success, stage_user returns a secret (that'll get baked into a url
        // and given to the user), on failure it throws
        var secret = db.stageUser(stageParams);
        
        // store the email being registered in the session data
        if (!req.session) req.session = {};
        
        // store inside the session the details of this pending verification
        req.session.pendingVerification = {
          email: stageParams.email,
          hash: stageParams.hash // we must store both email and password to handle the case where
          // a user re-creates an account - specifically, registration status
          // must ensure the new credentials work to properly verify that
          // the user has clicked throught the email link. note, this salted, bcrypted
          // representation of a user's password will get thrust into an encrypted cookie
          // served over an encrypted (SSL) session.  guten, yah.
        };
        
        httputils.jsonResponse(resp, true);

        // let's now kick out a verification email!
        email.sendVerificationEmail(stageParams.email, stageParams.site, secret);

      } catch(e) {
        // we should differentiate tween' 400 and 500 here.
        httputils.badRequest(resp, e.toString());
      }
    });

  app.get('/wsapi/registration_status', function(req, resp) {
      if (!req.session ||
          (!(typeof req.session.pendingVerification === 'object') &&
           !(typeof req.session.pendingAddition === 'string')))
        {
          httputils.badRequest(resp, "api abuse: registration_status called without a pending email addition/verification");
          return;
        }

      // Is the current session trying to add an email, or register a new one?
      if (req.session.pendingAddition) {
        // this is a pending email addition, it requires authentication
        if (!isAuthed(req, resp)) {
          return httputils.badRequest(resp, "requires authentication");
        }

        // check if the currently authenticated user has the email stored under pendingAddition
        // in their acct.
        db.emailsBelongToSameAccount(req.session.pendingAddition,
                                     req.session.authenticatedUser,
                                     function(registered) {
                                       if (registered) {
                                         delete req.session.pendingAddition;
                                         httputils.jsonResponse(resp, "complete");
                                       } else {
                                         httputils.jsonResponse(resp, "pending");
                                       }
                                     });
      } else {
        // this is a pending registration, let's check if the creds stored on the
        // session are good yet.

        var v = req.session.pendingVerification;
        db.checkAuth(v.email, function(hash) {
            if (hash === v.hash) {
              delete req.session.pendingVerification;
              req.session.authenticatedUser = v.email;
              httputils.jsonResponse(resp, "complete");
            } else {
              httputils.jsonResponse(resp, "pending");
            }
          });
      }
    });


  app.get('/wsapi/authenticate_user', checkParams(["email", "pass"]), function(req, resp) {
      db.checkAuth(req.query.email, function(hash) {
          var success = bcrypt.compare_sync(req.query.pass, hash);

          if (success) {
            if (!req.session) req.session = {};
            req.session.authenticatedUser = req.query.email;
          }
          httputils.jsonResponse(resp, success);
        });
    });

  // FIXME: need CSRF protection
  app.get('/wsapi/add_email', checkAuthed, checkParams(["email", "pubkey", "site"]), function (req, resp) {
      try {
        // upon success, stage_user returns a secret (that'll get baked into a url
        // and given to the user), on failure it throws
        var secret = db.stageEmail(req.session.authenticatedUser, req.query.email, req.query.pubkey);

        // store the email being added in session data
        req.session.pendingAddition = req.query.email;

        httputils.jsonResponse(resp, true);
        
        // let's now kick out a verification email!
        email.sendVerificationEmail(req.query.email, req.query.site, secret);
      } catch(e) {
        // we should differentiate tween' 400 and 500 here.
        httputils.badRequest(resp, e.toString());
      }
    });

  app.post('/wsapi/remove_email', checkAuthed, checkParams(["email"]), function(req, resp) {
      var email = req.body.email;
      
      db.removeEmail(req.session.authenticatedUser, email, function(error) {
          if (error) {
            console.log("error removing email " + email);
            httputils.badRequest(resp, error.toString());
          } else {
            httputils.jsonResponse(resp, true);
          }});
    });

  app.post('/wsapi/account_cancel', checkAuthed, function(req, resp) {
      db.cancelAccount(req.session.authenticatedUser, function(error) {
          if (error) {
            console.log("error cancelling account : " + error.toString());
            httputils.badRequest(resp, error.toString());
          } else {
            httputils.jsonResponse(resp, true);
          }});
    });

  app.get('/wsapi/set_key', checkAuthed, checkParams(["email", "pubkey"]), function (req, resp) {
      db.addKeyToEmail(req.session.authenticatedUser, req.query.email, req.query.pubkey, function (rv) {
          httputils.jsonResponse(resp, rv);
        });
    });

  app.get('/wsapi/am_authed', function(req,resp) {
      // if they're authenticated for an email address that we don't know about,
      // then we should purge the stored cookie
      if (!isAuthed(req)) {
        httputils.jsonResponse(resp, false);
      } else {
        db.emailKnown(req.session.authenticatedUser, function (known) {
            if (!known) req.session = {}
            httputils.jsonResponse(resp, known);
          });
      }
    });

  app.get('/wsapi/logout', function(req,resp) {
      req.session = {};
      httputils.jsonResponse(resp, "ok");
    });

  app.post('/wsapi/sync_emails', checkAuthed, function(req,resp) {
      var emails = req.body;

      db.getSyncResponse(req.session.authenticatedUser, emails, function(err, syncResponse) {
          if (err) httputils.serverError(resp, err);
          else httputils.jsonResponse(resp, syncResponse);
        });
    });

  app.get('/wsapi/prove_email_ownership', checkParams(["token"]), function(req, resp) {
      db.gotVerificationSecret(req.query.token, function(e) {
          if (e) {
            console.log("error completing the verification: " + e);
            httputils.jsonResponse(resp, false);
          } else {
            httputils.jsonResponse(resp, true);
          }
        });
    });
}

exports.setup = setup;
