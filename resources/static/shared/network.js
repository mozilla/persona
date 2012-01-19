/*jshint browsers:true, forin: true, laxbreak: true */
/*global BrowserID: true, _: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Network = (function() {
  "use strict";

  var bid = BrowserID,
      mediator = bid.Mediator,
      csrf_token,
      xhr = $,
      server_time,
      domain_key_creation_time,
      auth_status,
      code_version,
      time_until_delay

  function xhrError(cb, info) {
    return function(jqXHR, textStatus, errorThrown) {
      info = info || {};
      var network = info.network = info.network || {};

      network.status = jqXHR && jqXHR.status;
      network.textStatus = textStatus;
      network.errorThrown = errorThrown;
      network.responseText = jqXHR.responseText;

      if (cb) cb(info);
    };
  }

  function xhrDelay(reqInfo) {
    mediator.publish("xhr_delay", reqInfo);
  }

  function xhrComplete(reqInfo) {
    mediator.publish("xhr_complete", reqInfo);
  }

  function request(options) {
    // We defer the responses because otherwise jQuery eats any exceptions
    // that are thrown in the response handlers and it becomes very difficult
    // to debug.
    var successCB = options.success,
        errorCB = options.error,
        delayTimeout,
        reqInfo = {
          network: {
            type: options.type.toUpperCase(),
            url: options.url
          }
        },
        success = function(resp, jqXHR, textResponse) {
          if(delayTimeout) {
            clearTimeout(delayTimeout);
            delayTimeout = null;
          }

          xhrComplete(reqInfo);
          if(options.defer_success) {
            _.defer(successCB.curry(resp, jqXHR, textResponse));
          }
          else {
            successCB(resp, jqXHR, textResponse);
          }
        },
        error = function(resp, jqXHR, textResponse) {
          if(delayTimeout) {
            clearTimeout(delayTimeout);
            delayTimeout = null;
          }

          xhrComplete(reqInfo);
          _.defer(xhrError(errorCB, reqInfo).curry(resp, jqXHR, textResponse));
        }

    var req = _.extend({}, options, {
      success: success,
      error: error
    });

    if(time_until_delay) {
      delayTimeout = setTimeout(xhrDelay.curry(reqInfo), time_until_delay);
    };

    mediator.publish("xhr_start", reqInfo);
    xhr.ajax(req);
  }

  function get(options) {
    var req = _.extend(options, {
      type: "GET",
      defer_success: true
    });
    request(req);
  }

  function withContext(cb, onFailure) {
    if (typeof csrf_token === 'string') cb();
    else {
      // We do not use get because the success response is deferred making our
      // local/server time offset calculations skewed.
      request({
        type: "GET",
        url: "/wsapi/session_context",
        success: function(result) {
          csrf_token = result.csrf_token;
          server_time = {
            remote: result.server_time,
            local: (new Date()).getTime()
          };
          domain_key_creation_time = result.domain_key_creation_time;
          auth_status = result.auth_level;
          code_version = result.code_version;

          // seed the PRNG
          // FIXME: properly abstract this out, probably by exposing a jwcrypto
          // interface for randomness
          require("./libs/all").sjcl.random.addEntropy(result.random_seed);

          _.defer(cb);
        },
        error: onFailure
      });
    }
  }

  function clearContext() {
    var undef;
    csrf_token = server_time = auth_status = undef;
  }

  function post(options) {
    withContext(function() {
      var data = options.data || {};
      data.csrf = data.csrf || csrf_token;

      var req = _.extend(options, {
        type: "POST",
        data: data,
        defer_success: true
      });
      request(req);
    }, options.error);
  }

  function handleAuthenticationResponse(type, onComplete, onFailure, status) {
    if (onComplete) {
      try {
        var authenticated = status.success;

        if (typeof authenticated !== 'boolean') throw status;

        // at this point we know the authentication status of the
        // session, let's set it to perhaps save a network request
        // (to fetch session context).
        auth_status = authenticated && type;
        if (onComplete) onComplete(authenticated);
      } catch (e) {
        onFailure("unexpected server response: " + e);
      }
    }
  }

  var Network = {
    /**
     * Initialize - set the XHR object and clear all context info.
     * Used for testing.
     * @method init
     * @param {object} config - takes parameters:
     *   config.xhr - xhr object.
     *   config.time_until_delay - ms a request can run before it is
     *     considered delayed.
     */
    init: function(config) {
      if(config.hasOwnProperty("xhr")) {
        xhr = config.xhr;
      }

      if(config.hasOwnProperty("time_until_delay")) {
        time_until_delay = config.time_until_delay;
      }
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
          pass: password
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
          assertion: assertion
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
          if (onComplete) onComplete(auth_status);
        } catch(e) {
          if (onFailure) onFailure(e.toString());
        }
      }, onFailure);
    },

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
          if (onComplete) onComplete();
        },
        error: function(info, xhr, textStatus) {
          if (info.network.status === 400) {
            auth_status = false;
            if (onComplete) onComplete();
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
          if (onComplete) onComplete(status.success);
        },
        error: function(info) {
          // 403 is throttling.
          if (info.network.status === 403) {
            if (onComplete) onComplete(false);
          }
          else if (onFailure) onFailure(info);
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
          if (onComplete) onComplete(data);
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
          if (onComplete) onComplete(status.status);
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
          if (onComplete) onComplete(status.success);
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
          if (onComplete) onComplete(status.success);
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
          if (onComplete) onComplete(status.success);
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
          if (onComplete) onComplete(status.success);
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
          onComplete && onComplete(status.success);
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
          if (onComplete) onComplete(response.success);
        },
        error: function(info) {
          // 403 is throttling.
          if (info.network.status === 403) {
            if (onComplete) onComplete(false);
          }
          else if (onFailure) onFailure(info);
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
          if (onComplete) onComplete(status.status);
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
          if (onComplete) onComplete(data.email_known);
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
          if (onComplete) onComplete(data);
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
          if (onComplete) onComplete(status.success);
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
          pubkey: pubkey.serialize()
        },
        success: function(info) {
          var b=true;
          onComplete.apply(null, arguments);
        },
        error: function(info) {
          var b=true;

          onFailure.apply(null, arguments);
        }
      });
    },

    /**
     * List emails
     * @method listEmails
     */
    listEmails: function(onComplete, onFailure) {
      get({
        url: "/wsapi/list_emails",
        success: onComplete,
        error: onFailure
      });
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
          if (onComplete) onComplete(new Date(offset + server_time.remote));
        } catch(e) {
          if (onFailure) onFailure(e.toString());
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
          if (onComplete) onComplete(new Date(domain_key_creation_time));
        } catch(e) {
          if (onFailure) onFailure(e.toString());
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
        try {
          if (onComplete) onComplete(code_version);
        } catch(e) {
          if (onFailure) onFailure(e.toString());
        }
      }, onFailure);
    }
  };

  return Network;

}());
