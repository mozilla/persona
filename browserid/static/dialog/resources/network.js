/*jshint browsers:true, forin: true, laxbreak: true */
/*global BrowserID: true, _: true */
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
BrowserID.Network = (function() {
  "use strict";

  var csrf_token,
      xhr = $,
      server_time,
      auth_status,
      hub = window.OpenAjax && OpenAjax.hub;

  function deferResponse(cb) {
    if (cb) {
      return function() {
        var args = _.toArray(arguments);
        _.defer(function() {
          cb.apply(null, args);
        });
      };
    }
  }

  function xhrError(cb, errorMessage) {
    return function() {
      if (cb) cb();
      hub && hub.publish("xhrError", errorMessage);
    };
  }

  function get(options) {
    xhr.ajax({
      type: "GET",
      url: options.url,
      // We defer the responses because otherwise jQuery eats any exceptions 
      // that are thrown in the response handlers and it becomes very difficult 
      // to debug.
      success: deferResponse(options.success),
      error: deferResponse(xhrError(options.error, options.errorMessage)),
      dataType: "json"
    });
  }

  function post(options) {
    withContext(function() {
      var data = options.data || {};

      if(!data.csrf) {
        data.csrf = csrf_token;
      }

      xhr.ajax({
        type: "POST",
        url: options.url,
        data: data,
        // We defer the responses because otherwise jQuery eats any exceptions 
        // that are thrown in the response handlers and it becomes very difficult 
        // to debug.
        success: deferResponse(options.success),
        error: deferResponse(xhrError(options.error, options.errorMessage))
      });
    }, options.error);
  }

  function withContext(cb, onFailure) {
    if (typeof auth_status === 'boolean' && typeof csrf_token !== 'undefined') cb();
    else {
      xhr.ajax({
        url: "/wsapi/session_context",
        success: function(result) {
          csrf_token = result.csrf_token;
          server_time = {
            remote: result.server_time,
            local: (new Date()).getTime()
          };
          auth_status = result.authenticated;
          cb();
        },
        error: deferResponse(xhrError(onFailure))
      });
    }
  }

  function clearContext() {
    var undef;
    csrf_token = server_time = auth_status = undef;
  }

  // Not really part of the Network API, but related to networking
  $(document).bind("offline", function() {
    hub.publish("offline");
  });

  var Network = {
    /**
     * Set the XHR object and clear all context info.  Used for testing.
     * @method setXHR
     * @param {object} xhr - xhr object.
     */
    setXHR: function(newXHR) {
      xhr = newXHR;
      clearContext();
    },

    /**
     * Authenticate the current user
     * @method authenticate
     * @param {string} email - address to authenticate
     * @param {string} password - password.
     * @param {function} [onSuccess] - callback to call for success
     * @param {function} [onFailure] - called on XHR failure
     */
    authenticate: function(email, password, onSuccess, onFailure) {
      post({
        url: "/wsapi/authenticate_user",
        data: {
          email: email,
          pass: password
        },
        success: function(status, textStatus, jqXHR) {
          if (onSuccess) {
            try {
              var authenticated = status.success;

              if (typeof authenticated !== 'boolean') throw status;

              // at this point we know the authentication status of the
              // session, let's set it to perhaps save a network request
              // (to fetch session context).
              auth_status = authenticated;
              if(onSuccess) onSuccess(authenticated);
            } catch (e) {
              onFailure("unexpected server response: " + e);
            }
          }
        },
        error: onFailure
      });
    },

    /**
     * Check whether a user is currently logged in.
     * @method checkAuth
     * @param {function} [onSuccess] - Success callback, called with one 
     * boolean parameter, whether the user is authenticated.
     * @param {function} [onFailure] - called on XHR failure.
     */
    checkAuth: function(onSuccess, onFailure) {
      withContext(function() {
        try {
          if (typeof auth_status !== 'boolean') throw "can't get authentication status!";
          if (onSuccess) onSuccess(auth_status);
        } catch(e) {
          if (onFailure) onFailure(e.toString());
        }
      }, onFailure);
    },

    /**
     * Log the authenticated user out
     * @method logout
     * @param {function} [onSuccess] - called on completion
     * @param {function} [onFailure] - Called on XHR failure.
     */
    logout: function(onSuccess, onFailure) {
      post({
        url: "/wsapi/logout",
        success: function() {
          // assume the logout request is successful and
          // log the user out.  There is no need to reset the
          // CSRF token.
          // FIXME: we should return a confirmation that the
          // user was successfully logged out.
          auth_status = false;
          if (onSuccess) onSuccess();
        },
        error: onFailure
      });
    },

    /**
     * Create a new user.  Requires a user to verify identity.
     * @method createUser
     * @param {string} email - Email address to prepare.
     * @param {string} origin - site user is trying to sign in to.
     * @param {function} [onSuccess] - Callback to call when complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    createUser: function(email, origin, onSuccess, onFailure) {
      post({
        url: "/wsapi/stage_user",
        data: {
          email: email,
          site : origin
        },
        success: function(status) {
          if (onSuccess) onSuccess(status.success);
        },
        error: onFailure
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
    emailForVerificationToken: function(token, onSuccess, onFailure) {
      get({
        url : "/wsapi/email_for_token?token=" + encodeURIComponent(token),
        success: function(data) {
          if (onSuccess) onSuccess(data.email);
        },
        error: onFailure
      });
    },

    /**
     * Check the current user"s registration status
     * @method checkUserRegistration
     * @param {function} [onSuccess] - Called when complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    checkUserRegistration: function(email, onSuccess, onFailure) {
      get({
        url: "/wsapi/user_creation_status?email=" + encodeURIComponent(email),
        success: function(status, textStatus, jqXHR) {
          if (onSuccess) onSuccess(status.status);
        },
        error: onFailure
      });
    },

    /**
     * Complete user registration, give user a password
     * @method completeUserRegistration
     * @param {string} token - token to register for.
     * @param {string} password - password to register for account.
     * @param {function} [onSuccess] - Called when complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    completeUserRegistration: function(token, password, onSuccess, onFailure) {
      post({
        url: "/wsapi/complete_user_creation",
        data: {
          token: token,
          pass: password
        },
        success: function(status, textStatus, jqXHR) {
          if (onSuccess) onSuccess(status.success);
        },
        error: onFailure
      });
    },

    /**
     * Call with a token to prove an email address ownership.
     * @method completeEmailRegistration
     * @param {string} token - token proving email ownership.
     * @param {function} [onSuccess] - Callback to call when complete.  Called 
     * with one boolean parameter that specifies the validity of the token.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    completeEmailRegistration: function(token, onSuccess, onFailure) {
      post({
        url: "/wsapi/complete_email_addition",
        data: {
          token: token
        },
        success: function(status, textStatus, jqXHR) {
          if (onSuccess) onSuccess(status.success);
        },
        error: onFailure
      });
    },

    /**
     * Request a password reset for the given email address.
     * @method requestPasswordReset
     * @param {string} email - email address to reset password for.
     * @param {function} [onSuccess] - Callback to call when complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    requestPasswordReset: function(email, origin, onSuccess, onFailure) {
      if (email) {
        Network.createUser(email, origin, onSuccess, onFailure);
      } else {
        // TODO: if no email is provided, then what?
        throw "no email provided to password reset";
      }
    },

    /**
     * Update the password of the current user. This is for a password reseT
     * @method resetPassword
     * @param {string} password - new password.
     * @param {function} [onSuccess] - Callback to call when complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */ 
    resetPassword: function(password, onSuccess, onFailure) {
      // XXX fill this in.
      if (onSuccess) onSuccess();
    },

    /**
     * Update the password of the current user
     * @method changePassword
     * @param {string} oldpassword - old password.
     * @param {string} newpassword - new password.
     * @param {function} [onSuccess] - Callback to call when complete. Will be 
     * called with true if successful, false otw.
     * @param {function} [onFailure] - Called on XHR failure.
     */ 
    changePassword: function(oldPassword, newPassword, onSuccess, onFailure) {
      // XXX fill this in
      if (onSuccess) {
        onSuccess(true);
      }
    },


    /**
     * Cancel the current user"s account.
     * @method cancelUser
     * @param {function} [onSuccess] - called whenever complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    cancelUser: function(onSuccess, onFailure) {
      post({
        url: "/wsapi/account_cancel",
        success: onSuccess,
        error: onFailure
      });
    },

    /**
     * Add an email to the current user"s account.
     * @method addEmail
     * @param {string} email - Email address to add.
     * @param {string} origin - site user is trying to sign in to.
     * @param {function} [onsuccess] - called when complete.
     * @param {function} [onfailure] - called on xhr failure.
     */
    addEmail: function(email, origin, onSuccess, onFailure) {
      post({
        url: "/wsapi/stage_email",
        data: {
          email: email,
          site: origin
        },
        success: function(status) {
          if (onSuccess) onSuccess(status.success);
        },
        error: onFailure
      });
    },


    /**
     * Check the registration status of an email
     * @method checkEmailRegistration
     * @param {function} [onsuccess] - called when complete.
     * @param {function} [onfailure] - called on xhr failure.
     */
    checkEmailRegistration: function(email, onSuccess, onFailure) {
      get({
        url: "/wsapi/email_addition_status?email=" + encodeURIComponent(email),
        success: function(status, textStatus, jqXHR) {
          if (onSuccess) onSuccess(status.status);
        },
        error: onFailure
      });
    },

    /**
     * Check whether the email is already registered.
     * @method emailRegistered
     * @param {string} email - Email address to check.
     * @param {function} [onSuccess] - Called with one boolean parameter when 
     * complete.  Parameter is true if `email` is already registered, false 
     * otw.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    emailRegistered: function(email, onSuccess, onFailure) {
      get({
        url: "/wsapi/have_email?email=" + encodeURIComponent(email),
        success: function(data, textStatus, xhr) {
          if(onSuccess) onSuccess(data.email_known);
        },
        error: onFailure
      });
    },

    /**
     * Remove an email address from the current user.
     * @method removeEmail
     * @param {string} email - Email address to remove.
     * @param {function} [onSuccess] - Called whenever complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    removeEmail: function(email, onSuccess, onFailure) {
      post({
        url: "/wsapi/remove_email",
        data: {
          email: email
        },
        success: function(status, textStatus, jqXHR) {
          if (onSuccess) onSuccess(status.success);
        },
        error: onFailure
      });
    },

    /**
     * Certify the public key for the email address.
     * @method certKey
     */
    certKey: function(email, pubkey, onSuccess, onFailure) {
      post({
        url: "/wsapi/cert_key",
        data: {
          email: email,
          pubkey: pubkey.serialize()
        },
        success: onSuccess,
        error: onFailure
      });
    },

    /**
     * List emails
     * @method listEmails
     */
    listEmails: function(onSuccess, onFailure) {
      get({
        url: "/wsapi/list_emails",
        success: onSuccess,
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
    serverTime: function(onSuccess, onFailure) {
      withContext(function() {
        try {
          if (!server_time) throw "can't get server time!";
          var offset = (new Date()).getTime() - server_time.local;
          onSuccess(new Date(offset + server_time.remote));
        } catch(e) {
          onFailure(e.toString());
        }
      }, onFailure);
    }
  };

  return Network;

}());
