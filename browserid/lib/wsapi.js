// a module which implements the authorities web server api.
// it used to be that we stuffed every function in exports.
// now we're using proper express function registration to deal
// with HTTP methods and the like, apply middleware, etc.

const db = require('./db.js'),
      url = require('url'),
      httputils = require('./httputils.js');
      email = require('./email.js'),
      bcrypt = require('bcrypt');

function checkParams(getArgs, resp, params) {
  try {
    params.forEach(function(k) {
      if (!getArgs.hasOwnProperty(k) || typeof getArgs[k] !== 'string') {
        throw k;
      }
    });
  } catch(e) {
    httputils.badRequest(resp, "missing '" + e + "' argument");
    return false;
  }
  return true;
}

function isAuthed(req) {
  return (req.session && typeof req.session.authenticatedUser === 'string');
}

function checkAuthed(req, resp) {
  if (!isAuthed(req)) {
    httputils.badRequest(resp, "requires authentication");
    return false;
  }
  return true;
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
  app.get('/wsapi/stage_user', function(req, resp) {
      var urlobj = url.parse(req.url, true);
      var getArgs = urlobj.query;
      
      if (!checkParams(getArgs, resp, [ "email", "pass", "pubkey", "site" ])) {
        return;
      }

      // bcrypt the password
      getArgs.hash = bcrypt.encrypt_sync(getArgs.pass, bcrypt.gen_salt_sync(4));
        
      try {
        // upon success, stage_user returns a secret (that'll get baked into a url
        // and given to the user), on failure it throws
        var secret = db.stageUser(getArgs);
        
        // store the email being registered in the session data
        if (!req.session) req.session = {};
        
        // store inside the session the details of this pending verification
        req.session.pendingVerification = {
          email: getArgs.email,
          hash: getArgs.hash // we must store both email and password to handle the case where
          // a user re-creates an account - specifically, registration status
          // must ensure the new credentials work to properly verify that
          // the user has clicked throught the email link. note, this salted, bcrypted
          // representation of a user's password will get thrust into an encrypted cookie
          // served over an encrypted (SSL) session.  guten, yah.
        };
        
        httputils.jsonResponse(resp, true);
        
        // let's now kick out a verification email!
        email.sendVerificationEmail(getArgs.email, getArgs.site, secret);
        
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
        if (!checkAuthed(req, resp)) return;
        
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
        db.checkAuthHash(v.email, v.hash, function(authed) {
            if (authed) {
              delete req.session.pendingVerification;
              req.session.authenticatedUser = v.email;
              httputils.jsonResponse(resp, "complete");
            } else {
              httputils.jsonResponse(resp, "pending");
            }
          });
      }
    });
  
  
  app.get('/wsapi/authenticate_user', function(req, resp) {
      var urlobj = url.parse(req.url, true);
      var getArgs = urlobj.query;
      
      if (!checkParams(getArgs, resp, [ "email", "pass" ])) return;
      
      db.checkAuth(getArgs.email, getArgs.pass, function(rv) {
          if (rv) {
            if (!req.session) req.session = {};
            req.session.authenticatedUser = getArgs.email;
          }
          httputils.jsonResponse(resp, rv);
        });
    });
    
  // FIXME: need CSRF protection
  app.get('/wsapi/add_email', function (req, resp) {
      var urlobj = url.parse(req.url, true);
      var getArgs = urlobj.query;
      
      if (!checkParams(getArgs, resp, [ "email", "pubkey", "site" ])) return;
      
      if (!checkAuthed(req, resp)) return;
      
      try {
        // upon success, stage_user returns a secret (that'll get baked into a url
        // and given to the user), on failure it throws
        var secret = db.stageEmail(req.session.authenticatedUser, getArgs.email, getArgs.pubkey);
        
        // store the email being added in session data
        req.session.pendingAddition = getArgs.email;
        
        httputils.jsonResponse(resp, true);
        
        // let's now kick out a verification email!
        email.sendVerificationEmail(getArgs.email, getArgs.site, secret);
      } catch(e) {
        // we should differentiate tween' 400 and 500 here.
        httputils.badRequest(resp, e.toString());
      }
    });

  app.get('/wsapi/remove_email', function(req, resp) {
      // this should really be POST, but for now I'm having trouble seeing
      // how to get POST args properly, so it's a GET (Ben).
      // hmmm, I really want express or some other web framework!
      var urlobj = url.parse(req.url, true);
      var getArgs = urlobj.query;
      
      if (!checkParams(getArgs, resp, [ "email"])) return;
      if (!checkAuthed(req, resp)) return;
      
      db.removeEmail(req.session.authenticatedUser, getArgs.email, function(error) {
          if (error) {
            console.log("error removing email " + getArgs.email);
            httputils.badRequest(resp, error.toString());
          } else {
            httputils.jsonResponse(resp, true);
          }});
    });

  app.get('/wsapi/account_cancel', function(req, resp) {
      // this should really be POST
      if (!checkAuthed(req, resp)) return;
      
      db.cancelAccount(req.session.authenticatedUser, function(error) {
          if (error) {
            console.log("error cancelling account : " + error.toString());
            httputils.badRequest(resp, error.toString());
          } else {
            httputils.jsonResponse(resp, true);
          }});
    });

  app.get('/wsapi/set_key', function (req, resp) {
      var urlobj = url.parse(req.url, true);
      var getArgs = urlobj.query;
      if (!checkParams(getArgs, resp, [ "email", "pubkey" ])) return;
      if (!checkAuthed(req, resp)) return;
      db.addKeyToEmail(req.session.authenticatedUser, getArgs.email, getArgs.pubkey, function (rv) {
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

  app.post('/wsapi/sync_emails', function(req,resp) {
      if (!checkAuthed(req, resp)) return;
      
      var requestBody = "";
      req.on('data', function(str) {
          requestBody += str;
        });
      req.on('end', function() {
          try {
            var emails = JSON.parse(requestBody);
          } catch(e) {
            httputils.badRequest(resp, "malformed payload: " + e);
          }
          db.getSyncResponse(req.session.authenticatedUser, emails, function(err, syncResponse) {
              if (err) httputils.serverError(resp, err);
              else httputils.jsonResponse(resp, syncResponse);
            });
        });
    });

  app.get('/wsapi/prove_email_ownership', function(req, resp) {
      var urlobj = url.parse(req.url, true);
      var getArgs = urlobj.query;
      
      // validate inputs
      if (!checkParams(getArgs, resp, [ "token" ])) return;
      
      db.gotVerificationSecret(getArgs.token, function(e) {
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
