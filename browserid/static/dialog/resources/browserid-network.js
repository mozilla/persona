/*jshint browsers:true, forin: true, laxbreak: true */
/*global _: true, console: true, addEmail: true, removeEmail: true, clearEmails: true, CryptoStubs: true */
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
var BrowserIDNetwork = (function() {
  "use strict";

  var csrf_token = undefined;

  function withCSRF(cb) {
    if (csrf_token) setTimeout(cb, 0);
    else {
      $.get('/wsapi/csrf', {}, function(result) {
        csrf_token = result;
        cb();
      }, 'html');
    }
  }

  function filterOrigin(origin) {
    return origin.replace(/^.*:\/\//, '');
  }

  var Network = {
    /**
     * Set the origin of the current host being logged in to.
     * @method setOrigin
     * @param {string} origin
     */
    setOrigin: function(origin) {
      BrowserIDNetwork.origin = filterOrigin(origin);
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
      withCSRF(function() { 
        $.ajax({
          type: "POST",
          url: '/wsapi/authenticate_user',
          data: {
            email: email,
            pass: password,
            csrf: csrf_token
          },
          success: function(status, textStatus, jqXHR) {
            if(onSuccess) {
              var authenticated = JSON.parse(status);
              onSuccess(authenticated);
            }
          },
          error: onFailure
        });
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
      $.ajax({
        url: '/wsapi/am_authed',
        success: function(status, textStatus, jqXHR) {
          var authenticated = JSON.parse(status);
          onSuccess(authenticated);
        },
        error: onFailure
      });

    },

    /**
     * Log the authenticated user out
     * @method logout
     * @param {function} [onSuccess] - called on completion
     */
    logout: function(onSuccess) {
      withCSRF(function() { 
        $.post("/wsapi/logout", {
          csrf: csrf_token
        }, function() {
          csrf_token = undefined;
          withCSRF(function() {
            if(onSuccess) {
              onSuccess();
            }
          });
        } );
      });
    },

    /**
     * Create a new user or reset a current user's password.  Requires a user 
     * to verify identity.
     * changes for certs: removed keypair.
     * @method stageUser
     * @param {string} email - Email address to prepare.
     * @param {string} password - Password for user.
     * @param {object} keypair - User's public/private key pair.
     * @param {function} [onSuccess] - Callback to call when complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    stageUser: function(email, password, onSuccess, onFailure) {
      withCSRF(function() { 
        $.ajax({
          type: "post",
          url: '/wsapi/stage_user',
          data: {
            email: email,
            pass: password,
            site : BrowserIDNetwork.origin || document.location.host,
            csrf : csrf_token
          },
          success: onSuccess,
          error: onFailure
        });
      });
    },

    /**
     * Call with a token to prove an email address ownership.
     * @method proveEmailOwnership
     * @param {string} token - token proving email ownership.
     * @param {function} [onSuccess] - Callback to call when complete.  Called 
     * with one boolean parameter that specifies the validity of the token.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    proveEmailOwnership: function(token, onSuccess, onFailure) {
      $.ajax({
        url: '/wsapi/prove_email_ownership',
        data: {
          token: token
        },
        success: function(status, textStatus, jqXHR) {
          if (onSuccess) {
            var valid = JSON.parse(status);
            onSuccess(valid);
          }
        },
        error: onFailure
      });
    },

    /**
     * Cancel the current user's account.
     * @method cancelUser
     * @param {function} [onSuccess] - called whenever complete.
     */
    cancelUser: function(onSuccess) {
      withCSRF(function() {
        $.post("/wsapi/account_cancel", {"csrf": csrf_token}, function(result) {
          // XXX move this out of here, we now have 
          // BrowserIDIdentities.clearStoredIdentities
          clearEmails();
          if(onSuccess) {
            onSuccess();
          }
        });
      });
    },

    /**
     * Add an email to the current user's account.
     * @method addEmail
     * @param {string} email - Email address to add.
     * @param {function} [onSuccess] - Called when complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    addEmail: function(email, onSuccess, onFailure) {
      withCSRF(function() { 
        $.ajax({
          type: 'POST',
          url: '/wsapi/add_email',
          data: {
            email: email,
            site: BrowserIDNetwork.origin || document.location.host,
            csrf: csrf_token
          },
          success: onSuccess,
          error: onFailure
        });
      });
    },

    /**
     * Check whether the email is already registered.
     * @method haveEmail
     * @param {string} email - Email address to check.
     * @param {function} [onSuccess] - Called with one boolean parameter when 
     * complete.  Parameter is true if `email` is already registered, false 
     * otw.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    haveEmail: function(email, onSuccess, onFailure) {
      $.ajax({
        url: '/wsapi/have_email?email=' + encodeURIComponent(email),
        success: function(data, textStatus, xhr) {
          if(onSuccess) {
            var success = typeof data === 'string' ? !JSON.parse(data) : data;
            onSuccess(success);
          }
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
      withCSRF(function() { 
        $.ajax({
          type: 'POST',
          url: '/wsapi/remove_email',
          data: {
            email: email,
            csrf: csrf_token
          },
          success: onSuccess,
          failure: onFailure
        });
      });
    },

    /**
     * Check the current user's registration status
     * @method checkRegistration
     * @param {function} [onSuccess] - Called when complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    checkRegistration: function(onSuccess, onFailure) {
      $.ajax({
          url: '/wsapi/registration_status',
          success: function(status, textStatus, jqXHR) {
            if(onSuccess) {
              onSuccess(status);
            }
          },
          error: onFailure
      });
    },

    /**
     * Set the public key for the email address.
     * @method setKey
     */
    setKey: function(email, keypair, onSuccess, onError) {
      withCSRF(function() { 
        $.ajax({
          type: 'POST',
          url: '/wsapi/set_key',
          data: {
            email: email,
            pubkey: keypair.pub,
            csrf: csrf_token
          },
          success: onSuccess,
          error: onError
        });
      });
    },

    /**
     * Certify the public key for the email address.
     * @method certKey
     */
    certKey: function(email, pubkey, onSuccess, onError) {
      withCSRF(function() { 
        $.ajax({
          type: 'POST',
          url: '/wsapi/cert_key',
          data: {
            email: email,
            pubkey: pubkey.serialize(),
            csrf: csrf_token
          },
          success: onSuccess,
          error: onError
        });
      });
    },

    /**
     * List emails
     * @method listEmails
     */
    listEmails: function(onSuccess, onFailure) {
      $.ajax({
        type: "GET",
        url: "/wsapi/list_emails",
        success: onSuccess,
        error: onFailure
      });
    },
    
    /**
     * Sync emails
     * @method syncEmails
     * @param {object} issued_identities - Identities to check against.
     * @param {function} [onSuccess] - Called with response when complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    syncEmails: function(issued_identities, onSuccess, onFailure) {
      withCSRF(function() { 
        $.ajax({
          type: "POST",
          url: '/wsapi/sync_emails',
          data: {
            emails: JSON.stringify(issued_identities),
            csrf: csrf_token
          },
          success: onSuccess,
          error: onFailure
        });
      });
    }

  };

  return Network;

}());
