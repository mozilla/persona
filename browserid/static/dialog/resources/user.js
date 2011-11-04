/*jshint browsers:true, forin: true, laxbreak: true */
/*global _: true, BrowserID: true */
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

BrowserID.User = (function() {
  "use strict";

  var jwk, jwt, vep, jwcert, origin,
      network = BrowserID.Network,
      storage = BrowserID.Storage,
      User;

  function prepareDeps() {
    if (!jwk) {
      jwk= require("./jwk");
      jwt = require("./jwt");
      vep = require("./vep");
      jwcert = require("./jwcert");
    }
  }

  "use strict";
  // remove identities that are no longer valid
  function cleanupIdentities() {
      var emails = storage.getEmails();
      var issued_identities = {};
      prepareDeps();
      _(emails).each(function(email_obj, email_address) {
        try {
          email_obj.pub = jwk.PublicKey.fromSimpleObject(email_obj.pub);
        } catch (x) {
          storage.invalidateEmail(email_address);
          return;
        }

        // no cert? reset
        if (!email_obj.cert) {
          storage.invalidateEmail(email_address);
        } else {
          try {
            // parse the cert
            var cert = new jwcert.JWCert();
            cert.parse(emails[email_address].cert);

            // check if needs to be reset, if it expires in 5 minutes
            var diff = cert.expires.valueOf() - new Date().valueOf();
            if (diff < 300000)
              storage.invalidateEmail(email_address);
          } catch (e) {
            // error parsing the certificate!  Maybe it's of an old/different
            // format?  just delete it.
            try { console.log("error parsing cert for", email_address ,":", e); } catch(e2) { }
            storage.invalidateEmail(email_address);
          }
        }
      });
  }

  function setAuthenticationStatus(authenticated) {
    var func = authenticated ? 'addClass' : 'removeClass';
    $('body')[func]('authenticated');

    if (!authenticated) {
      storage.clear();
    }
  }

  function registrationPoll(checkFunc, email, onSuccess, onFailure) {
    function poll() {
      checkFunc(email, function(status) {
        // registration status checks the status of the last initiated registration,
        // it's possible return values are:
        //   'complete' - registration has been completed
        //   'pending'  - a registration is in progress
        //   'mustAuth' - user must authenticate
        //   'noRegistration' - no registration is in progress
        if (status === "complete" || status === "mustAuth") {
          // As soon as the registration comes back as complete, we should 
          // ensure that the stagedOnBehalfOf is cleared so there is no stale 
          // data.
          storage.setStagedOnBehalfOf("");
          if (onSuccess) {
            onSuccess(status);
          }
        }
        else if (status === 'pending') {
          setTimeout(poll, 3000);
        }
        else if (onFailure) {
            onFailure(status);
        }
      }, onFailure);
    };

    poll();
  }


  /**
   * Certify an identity with the server, persist it to storage if the server 
   * says the identity is good
   * @method certifyEmailKeypair
   */
  function certifyEmailKeypair(email, keypair, onSuccess, onFailure) {
    network.certKey(email, keypair.publicKey, function(cert) {
      persistEmailKeypair(email, keypair, cert, onSuccess, onFailure);
    }, onFailure);      
  }
    
  /**
   * Persist an email address without a keypair
   * @method persistEmail
   * @param {string} email - Email address to persist.
   * @param {function} [onSuccess] - Called on successful completion. 
   * @param {function} [onFailure] - Called on error.
   */
  function persistEmail(email, onSuccess, onFailure) {
    storage.addEmail(email, {
      created: new Date() 
    });

    if (onSuccess) {
      onSuccess();
    }
  }

  /** 
   * Persist an address and key pair locally.
   * @method persistEmailKeypair
   * @param {string} email - Email address to persist.
   * @param {object} keypair - Key pair to save
   * @param {function} [onSuccess] - Called on successful completion. 
   * @param {function} [onFailure] - Called on error.
   */
  function persistEmailKeypair(email, keypair, cert, onSuccess, onFailure) {
    var now = new Date();
    var email_obj = storage.getEmails()[email] || {
      created: now
    };

    _.extend(email_obj, {
      updated: now,
      pub: keypair.publicKey.toSimpleObject(),
      priv: keypair.secretKey.toSimpleObject(),
      cert: cert
    });

    storage.addEmail(email, email_obj);

    if (onSuccess) {
      onSuccess();
    }
  }

  User = {
    /**
     * Set the interface to use for networking.  Used for unit testing.
     * @method setNetwork
     * @param {BrowserID.Network} networkInterface - BrowserID.Network 
     * compatible interface to use.
     */
    setNetwork: function(networkInterface) {
      network = networkInterface;
    },

    /**
     * setOrigin
     * @method setOrigin
     * @param {string} origin
     */
    setOrigin: function(originArg) {
      origin = originArg;
    },

    /**
     * Get the origin of the current host being signed in to.
     * @method getOrigin
     * @return {string} origin
     */
    getOrigin: function() {
      return origin;
    },

    /**
     * Get the hostname for the set origin
     * @method getHostname
     * @returns {string}
     */
    getHostname: function() {
      return origin.replace(/^.*:\/\//, "").replace(/:\d*$/, "");
    },

    /**
     * Create a user account - this creates an user account that must be verified.  
     * @method createUser
     * @param {string} email - Email address.
     * @param {function} [onSuccess] - Called on successful completion. 
     * @param {function} [onFailure] - Called on error.
     */
    createUser: function(email, onSuccess, onFailure) {
      var self=this;

      // remember this for later
      storage.setStagedOnBehalfOf(self.getHostname());
      
      network.createUser(email, origin, function(created) {
        if (onSuccess) {
          onSuccess(created);
        }
      }, onFailure);
    },

    /**
     * Poll the server until user registration is complete.
     * @method waitForUserValidation
     * @param {string} email - email address to check.
     * @param {function} [onSuccess] - Called to give status updates.
     * @param {function} [onFailure] - Called on error.
     */
    waitForUserValidation: function(email, onSuccess, onFailure) {
      registrationPoll(network.checkUserRegistration, email, onSuccess, onFailure);
    },

    /**
     * Verify a user
     * @method verifyUser
     * @param {string} token - token to verify.
     * @param {string} password - password to set for account.
     * @param {function} [onSuccess] - Called to give status updates.
     * @param {function} [onFailure] - Called on error.
     */
    verifyUser: function(token, password, onSuccess, onFailure) {
      network.emailForVerificationToken(token, function (email) {
        var invalidInfo = { valid: false };
        if (email) {
          network.completeUserRegistration(token, password, function (valid) {
            var info = valid ? {
              valid: valid,
              email: email,
              origin: storage.getStagedOnBehalfOf()
            } : invalidInfo;

            storage.setStagedOnBehalfOf("");

            if (onSuccess) onSuccess(info);
          }, onFailure);
        } else if(onSuccess) {
          onSuccess(invalidInfo);
        }
      }, onFailure);
    },

    /**
     * Set the password of the current user.
     * @method setPassword
     * @param {string} password - password to set
     * @param {function} [onSuccess] - Called on successful completion. 
     * @param {function} [onFailure] - Called on error.
     */
    setPassword: function(password, onSuccess, onFailure) {
      network.setPassword(password, onSuccess, onFailure);
    },

    /**
     * Request a password reset for the given email address.
     * @method requestPasswordReset
     * @param {string} email - email address to reset password for.
     * @param {function} [onSuccess] - Callback to call when complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    requestPasswordReset: function(email, onSuccess, onFailure) {
      network.requestPasswordReset(email, origin, onSuccess, onFailure);
    },

    /**
     * Cancel the current user's account.  Remove last traces of their 
     * identity.
     * @method cancelUser
     * @param {function} [onSuccess] - Called whenever complete.
     * @param {function} [onFailure] - called on error.
     */
    cancelUser: function(onSuccess, onFailure) {
      network.cancelUser(function() {
        setAuthenticationStatus(false);
        if (onSuccess) {
          onSuccess();
        }
      }, onFailure);

    },

    /**
     * Log the current user out.
     * @method logoutUser
     * @param {function} [onSuccess] - Called whenever complete.
     * @param {function} [onFailure] - called on error.
     */
    logoutUser: function(onSuccess, onFailure) {
      network.logout(function() {
        setAuthenticationStatus(false);
        if (onSuccess) {
          onSuccess();
        }
      }, onFailure);
    },

    /**
     * Sync local identities with browserid.org.  Generally should not need to 
     * be called.
     * @method syncEmails
     * @param {function} [onSuccess] - Called whenever complete.
     * @param {function} [onFailure] - Called on error.
     */
    syncEmails: function(onSuccess, onFailure) {
      cleanupIdentities();
      var issued_identities = this.getStoredEmailKeypairs();

      // FIXME for certs

      // send up all email/pubkey pairs to the server, it will response with a
      // list of emails that need new keys.  This may include emails in the
      // sent list, and also may include identities registered on other devices.
      // we'll go through the list and generate new keypairs

      // identities that don't have an issuer are primary authentications,
      // and we don't need to worry about rekeying them.

      var self = this;

      network.listEmails(function(emails) {
        // lists of emails
        var client_emails = _.keys(issued_identities);
        var server_emails = _.keys(emails);

        var emails_to_add = _.difference(server_emails, client_emails);
        var emails_to_remove = _.difference(client_emails, server_emails);

        // remove emails
        _.each(emails_to_remove, function(email) {
          // if it's not a primary
          if (!issued_identities[email].isPrimary)
            storage.removeEmail(email);
        });

        // keygen for new emails
        // asynchronous
        function addNextEmail() {
          if (!emails_to_add || !emails_to_add.length) {
            onSuccess();
            return;
          }

          var email = emails_to_add.shift();

          persistEmail(email, addNextEmail, onFailure);
        }

        addNextEmail();
      }, onFailure);
    },

    /**
     * Check whether the current user is authenticated.
     * @method checkAuthentication
     * @param {function} [onSuccess] - Called when check is complete with one 
     * boolean parameter, authenticated.  authenticated will be true if user is 
     * authenticated, false otw.
     * @param {function} [onFailure] - Called on error.
     */
    checkAuthentication: function(onSuccess, onFailure) {
      network.checkAuth(function(authenticated) {
        setAuthenticationStatus(authenticated);
        if (onSuccess) {
          onSuccess(authenticated);
        }
      }, onFailure);
    },

    /**
     * Check whether the current user is authenticated.  If authenticated, sync 
     * identities.
     * @method checkAuthenticationAndSync
     * @param {function} [onSuccess] - Called if authentication check succeeds 
     * but before sync starts.  Useful for displaying status messages about the 
     * sync taking a moment.
     * @param {function} [onComplete] - Called on sync completion.
     * @param {function} [onFailure] - Called on error.
     */
    checkAuthenticationAndSync: function(onSuccess, onComplete, onFailure) {
      var self=this;
      network.checkAuth(function(authenticated) {
        setAuthenticationStatus(authenticated);
        if (authenticated) {
          if (onSuccess) {
            onSuccess(authenticated);
          }

          self.syncEmails(function() {
            if (onComplete) {
              onComplete(authenticated);
            }
          }, onFailure);
        }
        else {
          onComplete(authenticated);
        }
      }, onFailure);
    },

    /**
     * Authenticate the user with the given email and password.
     * @method authenticate
     * @param {string} email - Email address to authenticate.
     * @param {string} password - Password.
     * @param {function} [onComplete] - Called on sync completion.
     * @param {function} [onFailure] - Called on error.
     */
    authenticate: function(email, password, onComplete, onFailure) {
      var self=this;
      network.authenticate(email, password, function(authenticated) {
        setAuthenticationStatus(authenticated);
        if (onComplete) {
          onComplete(authenticated);
        }
      }, onFailure);
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
    isEmailRegistered: function(email, onSuccess, onFailure) {
      network.emailRegistered(email, onSuccess, onFailure);
    },

    /**
     * Add an email address to an already created account.  Sends address and 
     * keypair to the server, user then needs to verify account ownership. This 
     * does not add the new email address/keypair to the local list of 
     * valid identities.
     * @method addEmail
     * @param {string} email - Email address.
     * @param {function} [onSuccess] - Called on successful completion. 
     * @param {function} [onFailure] - Called on error.
     */
    addEmail: function(email, onSuccess, onFailure) {
      var self = this;
      network.addEmail(email, origin, function(added) {
        if (added) {
          storage.setStagedOnBehalfOf(self.getHostname());
          // we no longer send the keypair, since we will certify it later.
          if (onSuccess) {
            onSuccess(added);
          }
        }
      }, onFailure);
    },

    /**
     * Wait for the email registration to complete
     * @method waitForEmailValidation
     * @param {string} email - email address to check.
     * @param {function} [onSuccess] - Called to give status updates.
     * @param {function} [onFailure] - Called on error.
     */
    waitForEmailValidation: function(email, onSuccess, onFailure) {
      registrationPoll(network.checkEmailRegistration, email, onSuccess, onFailure);
    },

    /**
     * Verify a users email address given by the token
     * @method verifyEmail
     * @param {string} token
     * @param {function} [onSuccess] - Called on success.
     *   Called with an object with valid, email, and origin if valid, called 
     *   with only valid otw.
     * @param {function} [onFailure] - Called on error.
     */
    verifyEmail: function(token, onSuccess, onFailure) {
      network.emailForVerificationToken(token, function (email) {
        var invalidInfo = { valid: false };
        if (email) {
          network.completeEmailRegistration(token, function (valid) {
            var info = valid ? {
              valid: valid,
              email: email,
              origin: storage.getStagedOnBehalfOf()
            } : invalidInfo;

            storage.setStagedOnBehalfOf("");

            if (onSuccess) onSuccess(info);
          }, onFailure);
        } else if(onSuccess) {
          onSuccess(invalidInfo);
        }
      }, onFailure);
    },

    /**
     * Remove an email address.
     * @method removeEmail
     * @param {string} email - Email address to remove.
     * @param {function} [onSuccess] - Called when complete.
     * @param {function} [onFailure] - Called on error.
     */
    removeEmail: function(email, onSuccess, onFailure) {
      if(storage.getEmail(email)) {
        network.removeEmail(email, function() {
          storage.removeEmail(email);
          if (onSuccess) {
            onSuccess();
          }
        }, onFailure);
      } else if(onSuccess) {
        onSuccess();
      }
    },

    /**
     * Sync an identity with the server.  Creates and stores locally and on the 
     * server a keypair for the given email address.
     * @method syncEmailKeypair
     * @param {string} email - Email address.
     * @param {string} [issuer] - Issuer of keypair.
     * @param {function} [onSuccess] - Called on successful completion. 
     * @param {function} [onFailure] - Called on error.
     */
    syncEmailKeypair: function(email, onSuccess, onFailure) {
      // FIXME use true key sizes
      prepareDeps();
      var keypair = jwk.KeyPair.generate(vep.params.algorithm, 64);
      certifyEmailKeypair(email, keypair, onSuccess, onFailure);
    },


    /**
     * Get an assertion for an identity
     * @method getAssertion
     * @param {string} email - Email to get assertion for.
     * @param {function} [onSuccess] - Called with assertion on success.
     * @param {function} [onFailure] - Called on error.
     */
    getAssertion: function(email, onSuccess, onFailure) {
      // we use the current time from the browserid servers
      // to avoid issues with clock drift on user's machine.
      // (issue #329)
        var storedID = storage.getEmail(email),
            assertion;

        function createAssertion(idInfo) {
          network.serverTime(function(serverTime) {
            var sk = jwk.SecretKey.fromSimpleObject(idInfo.priv);
            // assertions are valid for 2 minutes
            var expirationMS = serverTime.getTime() + (2 * 60 * 1000);
            var expirationDate = new Date(expirationMS);
            var tok = new jwt.JWT(null, expirationDate, origin);
            assertion = vep.bundleCertsAndAssertion([idInfo.cert], tok.sign(sk));
            if (onSuccess) {
              onSuccess(assertion);
            }
          }, onFailure);
        }

        if (storedID) {
          prepareDeps();
          if (storedID.priv) {
            // parse the secret key
            createAssertion(storedID);
          }
          else {
            // we have no key for this identity, go generate the key, 
            // sync it and then get the assertion recursively.
            User.syncEmailKeypair(email, function() {
              User.getAssertion(email, onSuccess, onFailure);
            }, onFailure);
          }
        }
        else if (onSuccess) {
          onSuccess();
        }
    },

    /**
     * Get the list of identities stored locally.
     * @method getStoredEmailKeypairs
     * @return {object} identities.
     */
    getStoredEmailKeypairs: function() {
      return storage.getEmails();
    },

    /**
     * Get an individual stored identity.
     * @method getStoredEmailKeypair
     * @return {object} identity information for email, if exists, undefined 
     * otw.
     */
    getStoredEmailKeypair: function(email) {
      return storage.getEmail(email);
    },

    /**
     * Clear the list of identities stored locally.
     * @method clearStoredEmailKeypairs
     */
    clearStoredEmailKeypairs: function() {
      storage.clear();
    }
  };

  User.setOrigin(document.location.host);

  return User;
}());
