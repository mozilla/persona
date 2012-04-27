/*jshint browsers:true, forin: true, laxbreak: true */
/*global BrowserID: true, _: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Network = (function() {
  "use strict";

  var bid = BrowserID,
      complete = bid.Helpers.complete,
      context,
      server_time,
      domain_key_creation_time,
      auth_status,
      code_version,
      userid,
      time_until_delay,
      mediator = bid.Mediator,
      xhr = bid.XHR,
      post = xhr.post,
      get = xhr.get,
      storage = bid.Storage;

  function setUserID(uid) {
    userid = uid;

    // TODO - Get this out of here and put it into user!

    // when session context returns with an authenticated user, update localstorage
    // to indicate we've seen this user on this device
    if (userid) {
      storage.usersComputer.setSeen(userid);
    }
  }

  function onContextChange(msg, result) {
    context = result;
    server_time = {
      remote: result.server_time,
      local: (new Date()).getTime()
    };
    domain_key_creation_time = result.domain_key_creation_time;
    auth_status = result.auth_level;
    code_version = result.code_version;
    setUserID(result.userid);

    // seed the PRNG
    // FIXME: properly abstract this out, probably by exposing a jwcrypto
    // interface for randomness
    require("./libs/all").sjcl.random.addEntropy(result.random_seed);
  }

  function withContext(cb, onFailure) {
    if(typeof context !== "undefined") cb(context);
    else {
      xhr.withContext(cb, onFailure);
    }
  }

  function clearContext() {
    xhr.clearContext();
    var undef;
    context = server_time = auth_status = userid = undef;
  }

  function handleAuthenticationResponse(type, onComplete, onFailure, status) {
    try {
      var authenticated = status.success;

      if (typeof authenticated !== 'boolean') throw status;

      // now update the userid which is set once the user is authenticated.
      // this is used to key off client side state, like whether this user has
      // confirmed ownership of this device
      setUserID(status.userid);

      // at this point we know the authentication status of the
      // session, let's set it to perhaps save a network request
      // (to fetch session context).
      auth_status = authenticated && type;
      complete(onComplete, authenticated);
    } catch (e) {
      onFailure("unexpected server response: " + e);
    }
  }

  var Network = {
    /**
     * Initialize - Clear all context info. Used for testing.
     * @method init
     */
    init: function(config) {
      // Any time the context info changes, we want to know about it.
      mediator.subscribe('context_info', onContextChange);

      clearContext();
    },

    /**
     * Authenticate the current user
     * @method authenticate
     * @param {string} email - address to authenticate
     * @param {string} password - password.
     * @param {function} [onComplete] - callback to call when complete.  Called
     * with status parameter - true if authenticated, false otw.
     * @param {function} [onFailure] - called on XHR failure
     */
    authenticate: function(email, password, onComplete, onFailure) {
      post({
        url: "/wsapi/authenticate_user",
        data: {
          email: email,
          pass: password,
          ephemeral: !storage.usersComputer.confirmed(email)
        },
        success: handleAuthenticationResponse.curry("password", onComplete, onFailure),
        error: onFailure
      });
    },

    /**
     * Authenticate with a primary generated assertion
     * @method authenticateWithAssertion
     * @param {string} email - address to authenticate
     * @param {string} assertion
     * @param {function} [onComplete] - callback to call when complete.  Called
     * with status parameter - true if authenticated, false otw.
     * @param {function} [onFailure] - called on XHR failure
     */
    authenticateWithAssertion: function(email, assertion, onComplete, onFailure) {
      post({
        url: "/wsapi/auth_with_assertion",
        data: {
          email: email,
          assertion: assertion,
          ephemeral: !storage.usersComputer.confirmed(email)
        },
        success: handleAuthenticationResponse.curry("assertion", onComplete, onFailure),
        error: onFailure
      });
    },

    /**
     * Check whether a user is currently logged in.
     * @method checkAuth
     * @param {function} [onComplete] - called with one
     * boolean parameter, whether the user is authenticated.
     * @param {function} [onFailure] - called on XHR failure.
     */
    checkAuth: function(onComplete, onFailure) {
      withContext(function() {
        try {
          complete(onComplete, auth_status);
        } catch(e) {
          complete(onFailure, e.toString());
        }
      }, onFailure);
    },

    /**
     * clear local cache, including authentication status and
     * other session data.
     *
     * @method clearContext
     */
    clearContext: clearContext,

    /**
     * Log the authenticated user out
     * @method logout
     * @param {function} [onComplete] - called on completion
     * @param {function} [onFailure] - Called on XHR failure.
     */
    logout: function(onComplete, onFailure) {
      post({
        url: "/wsapi/logout",
        success: function() {
          // assume the logout request is successful and
          // log the user out.  There is no need to reset the
          // CSRF token.
          // FIXME: we should return a confirmation that the
          // user was successfully logged out.
          auth_status = false;
          setUserID(undefined);
          complete(onComplete);
        },
        error: function(info, xhr, textStatus) {
          if (info.network.status === 400) {
            auth_status = false;
            complete(onComplete);
          }
          else {
            onFailure && onFailure(info);
          }
        }
      });
    },

    /**
     * Create a new user.  Requires a user to verify identity.
     * @method createUser
     * @param {string} email - Email address to prepare.
     * @param {string} origin - site user is trying to sign in to.
     * @param {function} [onComplete] - Callback to call when complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    createUser: function(email, origin, onComplete, onFailure) {
      post({
        url: "/wsapi/stage_user",
        data: {
          email: email,
          site : origin
        },
        success: function(status) {
          complete(onComplete, status.success);
        },
        error: function(info) {
          // 429 is throttling.
          if (info.network.status === 429) {
            complete(onComplete, false);
          }
          else complete(onFailure, info);
        }
      });
    },

    /**
     * Check the email address associated with a verification token
     * @method emailForVerificationToken
     * @param {string} token - Token to check
     *
     * TODO: think about whether this requires the right cookie
     * I think so (BA).
     */
    emailForVerificationToken: function(token, onComplete, onFailure) {
      get({
        url : "/wsapi/email_for_token?token=" + encodeURIComponent(token),
        success: function(result) {
          var data = null;
          if(result.success !== false) {
            // force needs_password to be set;
            data = _.extend({ needs_password: false }, result);
          }
          complete(onComplete, data);
        },
        error: onFailure
      });
    },

    /**
     * Check the current user"s registration status
     * @method checkUserRegistration
     * @param {function} [onComplete] - Called when complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    checkUserRegistration: function(email, onComplete, onFailure) {
      get({
        url: "/wsapi/user_creation_status?email=" + encodeURIComponent(email),
        success: function(status, textStatus, jqXHR) {
          if (status.status === 'complete' && status.userid) {
            // The user at this point can ONLY be logged in with password
            // authentication. Once the registration is complete, that means
            // the server has updated the user's cookies and the user is
            // officially authenticated.
            auth_status = 'password';
            setUserID(status.userid);
          }
          complete(onComplete, status.status);
        },
        error: onFailure
      });
    },

    /**
     * Complete user registration, give user a password
     * @method completeUserRegistration
     * @param {string} token - token to register for.
     * @param {string} password - password to register for account.
     * @param {function} [onComplete] - Called when complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    completeUserRegistration: function(token, password, onComplete, onFailure) {
      post({
        url: "/wsapi/complete_user_creation",
        data: {
          token: token,
          pass: password
        },
        success: function(status, textStatus, jqXHR) {
          complete(onComplete, status.success);
        },
        error: onFailure
      });
    },

    /**
     * Call with a token to prove an email address ownership.
     * @method completeEmailRegistration
     * @param {string} token - token proving email ownership.
     * @param {string} password - password to set if necessary.  If not necessary, set to undefined.
     * @param {function} [onComplete] - Callback to call when complete.  Called
     * with one boolean parameter that specifies the validity of the token.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    completeEmailRegistration: function(token, password, onComplete, onFailure) {
      post({
        url: "/wsapi/complete_email_addition",
        data: {
          token: token,
          pass: password
        },
        success: function(status, textStatus, jqXHR) {
          complete(onComplete, status.success);
        },
        error: onFailure
      });
    },

    /**
     * Request a password reset for the given email address.
     * @method requestPasswordReset
     * @param {string} email - email address to reset password for.
     * @param {function} [onComplete] - Callback to call when complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    requestPasswordReset: function(email, origin, onComplete, onFailure) {
      if (email) {
        Network.createUser(email, origin, onComplete, onFailure);
      } else {
        // TODO: if no email is provided, then what?
        throw "no email provided to password reset";
      }
    },

    /**
     * Set the password of the current user.
     * @method setPassword
     * @param {string} password - new password.
     * @param {function} [onComplete] - Callback to call when complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    setPassword: function(password, onComplete, onFailure) {
      post({
        url: "/wsapi/set_password",
        data: {
          password: password
        },
        success: function(status) {
          complete(onComplete, status.success);
        },
        error: onFailure
      });
    },

    /**
     * Update the password of the current user
     * @method changePassword
     * @param {string} oldpassword - old password.
     * @param {string} newpassword - new password.
     * @param {function} [onComplete] - Callback to call when complete. Will be
     * called with true if successful, false otw.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    changePassword: function(oldPassword, newPassword, onComplete, onFailure) {
      post({
        url: "/wsapi/update_password",
        data: {
          oldpass: oldPassword,
          newpass: newPassword
        },
        success: function(status) {
          complete(onComplete, status.success);
        },
        error: onFailure
      });
    },


    /**
     * Cancel the current user"s account.
     * @method cancelUser
     * @param {function} [onComplete] - called whenever complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    cancelUser: function(onComplete, onFailure) {
      post({
        url: "/wsapi/account_cancel",
        success: onComplete,
        error: onFailure
      });
    },

    /**
     * Add an email to the current user's account using an assertion.
     * @method addEmailWithAssertion
     * @param {string} assertion - assertion used to add user.
     * @param {function} [onComplete] - called when complete.
     * @param {function} [onFailure] - called on XHR failure.
     */
    addEmailWithAssertion: function(assertion, onComplete, onFailure) {
      post({
        url: "/wsapi/add_email_with_assertion",
        data: {
          assertion: assertion
        },
        success: function(status) {
          complete(onComplete, status.success);
        },
        error: onFailure
      });
    },

    /**
     * Add a secondary email to the current user's account.
     * @method addSecondaryEmail
     * @param {string} email - Email address to add.
     * @param {string} origin - site user is trying to sign in to.
     * @param {function} [onComplete] - called when complete.
     * @param {function} [onFailure] - called on xhr failure.
     */
    addSecondaryEmail: function(email, origin, onComplete, onFailure) {
      post({
        url: "/wsapi/stage_email",
        data: {
          email: email,
          site: origin
        },
        success: function(response) {
          complete(onComplete, response.success);
        },
        error: function(info) {
          // 429 is throttling.
          if (info.network.status === 429) {
            complete(onComplete, false);
          }
          else complete(onFailure, info);
        }
      });
    },


    /**
     * Check the registration status of an email
     * @method checkEmailRegistration
     * @param {function} [onsuccess] - called when complete.
     * @param {function} [onfailure] - called on xhr failure.
     */
    checkEmailRegistration: function(email, onComplete, onFailure) {
      get({
        url: "/wsapi/email_addition_status?email=" + encodeURIComponent(email),
        success: function(status, textStatus, jqXHR) {
          complete(onComplete, status.status);
        },
        error: onFailure
      });
    },

    /**
     * Check whether the email is already registered.
     * @method emailRegistered
     * @param {string} email - Email address to check.
     * @param {function} [onComplete] - Called with one boolean parameter when
     * complete.  Parameter is true if `email` is already registered, false
     * otw.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    emailRegistered: function(email, onComplete, onFailure) {
      get({
        url: "/wsapi/have_email?email=" + encodeURIComponent(email),
        success: function(data, textStatus, xhr) {
          complete(onComplete, data.email_known);
        },
        error: onFailure
      });
    },

    /**
     * Get information about an email address.  Who vouches for it?
     * (is it a primary or a secondary)
     * @method addressInfo
     * @param {string} email - Email address to check.
     * @param {function} [onComplete] - Called with an object on success,
     *   containing these properties:
     *     type: <secondary|primary>
     *     known: boolean, present - present if type is secondary
     *     auth: string - url to send users for auth - present if type is primary
     *     prov: string - url to embed for silent provisioning - present if type is secondary
     * @param {function} [onFailure] - Called on XHR failure.
     */
    addressInfo: function(email, onComplete, onFailure) {
      get({
        url: "/wsapi/address_info?email=" + encodeURIComponent(email),
        success: function(data, textStatus, xhr) {
          complete(onComplete, data);
        },
        error: onFailure
      });
    },

    /**
     * Remove an email address from the current user.
     * @method removeEmail
     * @param {string} email - Email address to remove.
     * @param {function} [onComplete] - Called whenever complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    removeEmail: function(email, onComplete, onFailure) {
      post({
        url: "/wsapi/remove_email",
        data: {
          email: email
        },
        success: function(status, textStatus, jqXHR) {
          complete(onComplete, status.success);
        },
        error: onFailure
      });
    },

    /**
     * Certify the public key for the email address.
     * @method certKey
     */
    certKey: function(email, pubkey, onComplete, onFailure) {
      post({
        url: "/wsapi/cert_key",
        data: {
          email: email,
          pubkey: pubkey.serialize(),
          ephemeral: !storage.usersComputer.confirmed(email)
        },
        success: onComplete,
        error: onFailure
      });
    },

    /**
     * List emails
     * @method listEmails
     */
    listEmails: function(onComplete, onFailure) {
      get({
        url: "/wsapi/list_emails",
        success: function(emails) {
          // TODO - Put this into user.js or storage.js when emails are synced/saved to
          // storage.
          // update our local storage map of email addresses to user ids
          if (userid) {
            storage.updateEmailToUserIDMapping(userid, _.keys(emails));
          }

          onComplete && onComplete(emails);
        },
        error: onFailure
      });
    },

    /**
     * TODO - move this into user.
     * Return the user's userid, which will an integer if the user
     * is authenticated, undefined otherwise.
     *
     * @method userid
     */
    userid: function() {
      return userid;
    },

    /**
     * Get the current time on the server in the form of a
     * date object.
     *
     * Note: this function will perform a network request if
     * during this session /wsapi/session_context has not
     * been called.
     *
     * @method serverTime
     */
    serverTime: function(onComplete, onFailure) {
      withContext(function() {
        try {
          if (!server_time) throw "can't get server time!";
          var offset = (new Date()).getTime() - server_time.local;
          complete(onComplete, new Date(offset + server_time.remote));
        } catch(e) {
          complete(onFailure, e.toString());
        }
      }, onFailure);
    },

    /**
     * Get the time at which the domain key was last updated.
     *
     * Note: this function will perform a network request if
     * during this session /wsapi/session_context has not
     * been called.
     *
     * @method domainKeyCreationTime
     */
    domainKeyCreationTime: function(onComplete, onFailure) {
      withContext(function() {
        try {
          if (!domain_key_creation_time) throw "can't get domain key creation time!";
          complete(onComplete, new Date(domain_key_creation_time));
        } catch(e) {
          complete(onFailure, e.toString());
        }
      }, onFailure);
    },

    /**
     * Get the most recent code version
     *
     * Note: this function will perform a network request if
     * during this session /wsapi/session_context has not
     * been called.
     *
     * @method codeVersion
     */
    codeVersion: function(onComplete, onFailure) {
      withContext(function() {
        complete(onComplete, code_version);
      }, onFailure);
    },

    /**
     * Check if the user's cookies are enabled
     * @method cookiesEnabled
     */
    cookiesEnabled: function(onComplete, onFailure) {
      // Make sure we get context first or else we will needlessly send
      // a cookie to the server.
      withContext(function() {
        try {
          // set a test cookie with a duration of 1 second.
          // NOTE - The Android 3.3 default browser will still pass this.
          // http://stackoverflow.com/questions/8509387/android-browser-not-respecting-cookies-disabled/9264996#9264996
          document.cookie = "test=true; max-age=1";
          var enabled = document.cookie.indexOf("test") > -1;
        } catch(e) {
          enabled = false;
        }

        complete(onComplete, enabled);
      }, onFailure);
    },

    /**
     * Prolong a user's session so that they are not re-prompted to enter their
     * password
     * @method prolongSession
     * @param {function} [onComplete] - Called whenever complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    prolongSession: function(onComplete, onFailure) {
      Network.checkAuth(function(authenticated) {
        if(authenticated) {
          post({
            url: "/wsapi/prolong_session",
            success: onComplete,
            error: onFailure
          });
        }
        else {
          complete(onFailure, "user not authenticated");
        }
      }, onFailure);
    }
  };

  return Network;

}());
