/*jshint browsers:true, forin: true, laxbreak: true */
/*global _: true, BrowserIDStorage: true, BrowserIDNetwork: true */
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

var BrowserIDIdentities = (function() {
  "use strict";

  var jwk, jwt, vep, jwcert, origin,
      network = BrowserIDNetwork,
      storage = BrowserIDStorage;

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
          storage.removeEmail(email_address);
          return;
        }

        // no cert? reset
        if (!email_obj.cert) {
          storage.removeEmail(email_address);
        } else {
          try {
            // parse the cert
            var cert = new jwcert.JWCert();
            cert.parse(emails[email_address].cert);

            // check if needs to be reset, if it expires in 5 minutes
            var diff = cert.expires.valueOf() - new Date().valueOf();
            if (diff < 300000)
              storage.removeEmail(email_address);
          } catch (e) {
            // error parsing the certificate!  Maybe it's of an old/different
            // format?  just delete it.
            try { console.log("error parsing cert for", email_address ,":", e); } catch(e2) { }
            storage.removeEmail(email_address);
          }
        }
      });
  }

  function removeUnknownIdentities(unknown_emails) {
    // first remove idenitites that the server doesn't know about
    if (unknown_emails) {
      _(unknown_emails).each(function(email_address) {
        storage.removeEmail(email_address);
      });
    }
  }

  function setAuthenticationStatus(authenticated) {
    var func = authenticated ? 'addClass' : 'removeClass';
    $('body')[func]('authenticated');

    if (!authenticated) {
      storage.clearEmails();
    }
  }

  function filterOrigin(origin) {
    return origin.replace(/^.*:\/\//, "");
  }

  function registrationPoll(checkFunc, email, onSuccess, onFailure) {
    function poll() {
      checkFunc(email, function(status) {
        // registration status checks the status of the last initiated registration,
        // it's possible return values are:
        //   'complete' - registration has been completed
        //   'pending'  - a registration is in progress
        //   'noRegistration' - no registration is in progress
        if (status === "complete") {
          if (onSuccess) {
            onSuccess(status);
          }
        }
        else if (status === 'pending') {
          setTimeout(poll, 3000);
        }
        else if (onFailure) {
            onFailure();
        }
      });
    };

    poll();
  }

  var Identities = {
    /**
     * Set the interface to use for networking.  Used for unit testing.
     * @method setNetwork
     * @param {BrowserIDNetwork} networkInterface - BrowserIDNetwork interface 
     * to use.
     */
    setNetwork: function(networkInterface) {
      network = networkInterface;
    },

    /**
     * setOrigin
     * @method setOrigin
     * @param {string} origin
     */
    setOrigin: function(unfilteredOrigin) {
      origin = filterOrigin(unfilteredOrigin);
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
     * Create a user account - this creates an user account that must be verified.  
     * @method createUser
     * @param {string} email - Email address.
     * @param {function} [onSuccess] - Called on successful completion. 
     * @param {function} [onFailure] - Called on error.
     */
    createUser: function(email, onSuccess, onFailure) {
      var self=this;
      // FIXME: keysize
      network.createUser(email, origin, function(created) {
        if (onSuccess) {
          var val = created;
          if(created) {
            prepareDeps();
            var keypair = jwk.KeyPair.generate(vep.params.algorithm, 64);
            self.stagedEmail = email;
            self.stagedKeypair = keypair;
            val = keypair;
          }

          onSuccess(val);
        }
      }, onFailure);
    },

    /**
     * Poll the server until user registration is complete.
     * @method waitForUserRegistration
     * @param {string} email - email address to check.
     * @param {function} [onSuccess] - Called to give status updates.
     * @param {function} [onFailure] - Called on error.
     */
    waitForUserRegistration: function(email, onSuccess, onFailure) {
      registrationPoll(network.checkUserRegistration, email, onSuccess, onFailure);
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
     * @param {function} [onFailure] - called on failure.
     */
    cancelUser: function(onSuccess, onFailure) {
      network.cancelUser(function() {
        setAuthenticationStatus(false);
        if (onSuccess) {
          onSuccess();
        }
      });

    },

    /**
     * Log the current user out.
     * @method logoutUser
     * @param {function} [onSuccess] - Called whenever complete.
     * @param {function} [onFailure] - called on failure.
     */
    logoutUser: function(onSuccess, onFailure) {
      network.logout(function() {
        setAuthenticationStatus(false);
        if (onSuccess) {
          onSuccess();
        }
      });
    },

    /**
     * Sync local identities with browserid.org.  Generally should not need to 
     * be called.
     * @method syncEmailKeypairs
     * @param {function} [onSuccess] - Called whenever complete.
     * @param {function} [onFailure] - Called on failure.
     */
    syncEmailKeypairs: function(onSuccess, onFailure) {
      cleanupIdentities();
      var issued_identities = Identities.getStoredEmailKeypairs();

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

          self.syncEmailKeypair(email, addNextEmail, onFailure);
        }

        addNextEmail();
      });
    },

    /**
     * Signifies that an identity has been confirmed.
     * @method confirmEmail
     * @param {string} email - Email address.
     * @param {function} [onSuccess] - Called on successful completion. 
     * @param {function} [onFailure] - Called on error.
     */
    confirmEmail: function(email, onSuccess, onFailure) {
      var self = this;
      if (email === self.stagedEmail) {
        var keypair = self.stagedKeypair;
        
        self.stagedEmail = null;
        self.stagedKeypair = null;

        // certify
        Identities.certifyEmailKeypair(email, keypair, function() {
          self.syncEmailKeypairs(onSuccess, onFailure);
        });

      }
      else if (onFailure) {
        onFailure();
      }
    },

    /**
     * Check whether the current user is authenticated.
     * @method checkAuthentication
     * @param {function} [onSuccess] - Called when check is complete with one 
     * boolean parameter, authenticated.  authenticated will be true if user is 
     * authenticated, false otw.
     * @param {function} [onFailure] - Called on failure.
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
     * @param {function} [onFailure] - Called on failure.
     */
    checkAuthenticationAndSync: function(onSuccess, onComplete, onFailure) {
      var self=this;
      network.checkAuth(function(authenticated) {
        setAuthenticationStatus(authenticated);
        if (authenticated) {
          if (onSuccess) {
            onSuccess(authenticated);
          }

          self.syncEmailKeypairs(function() {
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
     * Authenticate the user with the given email and password, if 
     * authentication successful, sync addresses with server.
     * @method authenticateAndSync
     * @param {string} email - Email address to authenticate.
     * @param {string} password - Password.
     * @param {function} [onSuccess] - Called whenever authentication succeeds 
     * but before sync starts.  Useful for displaying status messages about the 
     * sync taking a moment.
     * @param {function} [onComplete] - Called on sync completion.
     * @param {function} [onFailure] - Called on failure.
     */
    authenticateAndSync: function(email, password, onSuccess, onComplete, onFailure) {
      var self=this;
      network.authenticate(email, password, function(authenticated) {
        setAuthenticationStatus(authenticated);
        if (authenticated) {
          if (onSuccess) {
            onSuccess(authenticated);
          }

          self.syncEmailKeypairs(function() {
            if (onComplete) {
              onComplete(authenticated);
            }
          }, onFailure);
        } else if (onComplete) {
          // If not authenticated, we have to complete still.
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
    emailRegistered: function(email, onSuccess, onFailure) {
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
          prepareDeps();
          var keypair = jwk.KeyPair.generate(vep.params.algorithm, 64);

          self.stagedEmail = email;
          self.stagedKeypair = keypair;

          // we no longer send the keypair, since we will certify it later.
          if (onSuccess) {
            onSuccess(keypair);
          }
        }
      }, onFailure);
    },

    waitForEmailRegistration: function(email, onSuccess, onFailure) {
      registrationPoll(network.checkEmailRegistration, email, onSuccess, onFailure);
    },

    /**
     * Remove an email address.
     * @method removeEmail
     * @param {string} email - Email address to remove.
     * @param {function} [onSuccess] - Called when complete.
     * @param {function} [onFailure] - Called on failure.
     */
    removeEmail: function(email, onSuccess, onFailure) {
      network.removeEmail(email, function() {
        storage.removeEmail(email);
        if (onSuccess) {
          onSuccess();
        }
      }, onFailure);
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
      //var keypair = jwk.KeyPair.generate(vep.params.algorithm, vep.params.keysize);
      var keypair = jwk.KeyPair.generate(vep.params.algorithm, 64);
      Identities.certifyEmailKeypair(email, keypair, onSuccess, onFailure);
    },

    /**
     * Certify an identity
     */
    certifyEmailKeypair: function(email, keypair, onSuccess, onFailure) {
      network.certKey(email, keypair.publicKey, function(cert) {
        Identities.persistEmailKeypair(email, keypair, cert, function() {
          if (onSuccess) {
            onSuccess();
          }
        }, onFailure);
      }, onFailure);      
    },
    
    /** 
     * Persist an address and key pair locally.
     * @method persistEmailKeypair
     * @param {string} email - Email address to persist.
     * @param {object} keypair - Key pair to save
     * @param {function} [onSuccess] - Called on successful completion. 
     * @param {function} [onFailure] - Called on error.
     */
    persistEmailKeypair: function(email, keypair, cert, onSuccess, onFailure) {
      var new_email_obj= {
        created: new Date(),
        pub: keypair.publicKey.toSimpleObject(),
        priv: keypair.secretKey.toSimpleObject(),
        cert: cert
      };

      storage.addEmail(email, new_email_obj);

      if (onSuccess) {
        onSuccess();
      }
    },

    /**
     * Get an assertion for an identity
     * @method getAssertion
     * @param {string} email - Email to get assertion for.
     * @param {function} [onSuccess] - Called with assertion on success.
     * @param {function} [onFailure] - Called on failure.
     */
    getAssertion: function(email, onSuccess, onFailure) {
      var storedID = Identities.getStoredEmailKeypairs()[email],
          assertion;

      if (storedID) {
        // parse the secret key
        prepareDeps();
        var sk = jwk.SecretKey.fromSimpleObject(storedID.priv);
        var tok = new jwt.JWT(null, new Date(), origin);
        assertion = vep.bundleCertsAndAssertion([storedID.cert], tok.sign(sk));
      }

      if (onSuccess) {
        onSuccess(assertion);
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
     * Clear the list of identities stored locally.
     * @method clearStoredEmailKeypairs
     */
    clearStoredEmailKeypairs: function() {
      storage.clearEmails();
    },


  };

  Identities.setOrigin(document.location.host);

  return Identities;
}());
