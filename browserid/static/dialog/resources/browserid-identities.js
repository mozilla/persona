/*jshint browsers:true, forin: true, laxbreak: true */
/*global _: true, network: true, addEmail: true, removeEmail: true, clearEmails: true, getEmails: true, CryptoStubs: true */
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

var jwk = require("./jwk");
var jwt = require("./jwt");
var vep = require("./vep");

var BrowserIDIdentities = (function() {
  "use strict";
  function getIssuedIdentities() {
      var emails = getEmails();
      var issued_identities = {};
      _(emails).each(function(email_obj, email_address) {
        try {
          email_obj.pub = jwk.PublicKey.fromSimpleObject(email_obj.pub);
        } catch (x) {
          delete emails[email_address];
        }

        if (!email_obj.cert)
          delete emails[email_address];
      });

      return emails;
  }

  function removeUnknownIdentities(unknown_emails) {
    // first remove idenitites that the server doesn't know about
    if (unknown_emails) {
      _(unknown_emails).each(function(email_address) {
        removeEmail(email_address);
      });
    }
  }

  var network = BrowserIDNetwork;

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
     * Sync local identities with browserid.org.  Generally should not need to 
     * be called.
     * @method syncIdentities
     * @param {function} [onSuccess] - Called whenever complete.
     * @param {function} [onFailure] - Called on failure.
     */
    syncIdentities: function(onSuccess, onFailure) {
      var issued_identities = getIssuedIdentities();

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
            removeEmail(email);
        });

        // keygen for new emails
        // asynchronous
        function addNextEmail() {
          if (!emails_to_add || !emails_to_add.length) {
            onSuccess();
            return;
          }

          var email = emails_to_add.shift();

          self.syncIdentity(email, addNextEmail, onFailure);
        }

        addNextEmail();
      });
    },

    /**
     * Stage an identity - this creates an identity that must be verified.  
     * Used when creating a new account or resetting the password of an 
     * existing account.
     * FIXME: rename to indicate new account
     * @method stageIdentity
     * @param {string} email - Email address.
     * @param {function} [onSuccess] - Called on successful completion. 
     * @param {function} [onFailure] - Called on error.
     */
    stageIdentity: function(email, password, onSuccess, onFailure) {
      var self=this;
      // FIXME: keysize
      var keypair = jwk.KeyPair.generate(vep.params.algorithm, 64);

      self.stagedEmail = email;
      self.stagedKeypair = keypair;

      network.stageUser(email, password, function() {
        if (onSuccess) {
          onSuccess(keypair);
        }
      }, onFailure);
    },

    /**
     * Signifies that an identity has been confirmed.
     * @method confirmIdentity
     * @param {string} email - Email address.
     * @param {function} [onSuccess] - Called on successful completion. 
     * @param {function} [onFailure] - Called on error.
     */
    confirmIdentity: function(email, onSuccess, onFailure) {
      var self = this;
      if (email === self.stagedEmail) {
        var keypair = self.stagedKeypair;
        
        self.stagedEmail = null;
        self.stagedKeypair = null;

        // certify
        Identities.certifyIdentity(email, keypair, function() {
          self.syncIdentities(onSuccess, onFailure);
        });

      }
      else if (onFailure) {
        onFailure();
      }
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
        if (authenticated) {
          if (onSuccess) {
            onSuccess(authenticated);
          }

          self.syncIdentities(function() {
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
        if (authenticated) {
          if (onSuccess) {
            onSuccess(authenticated);
          }

          self.syncIdentities(function() {
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
     * Certify an identity
     */
    certifyIdentity: function(email, keypair, onSuccess, onFailure) {
      network.certKey(email, keypair.publicKey, function(cert) {
        Identities.persistIdentity(email, keypair, cert, function() {
          if (onSuccess) {
            onSuccess();
          }
        }, onFailure);
      }, onFailure);      
    },
    
    /**
     * Sync an identity with the server.  Creates and stores locally and on the 
     * server a keypair for the given email address.
     * @method syncIdentity
     * @param {string} email - Email address.
     * @param {string} [issuer] - Issuer of keypair.
     * @param {function} [onSuccess] - Called on successful completion. 
     * @param {function} [onFailure] - Called on error.
     */
    syncIdentity: function(email, onSuccess, onFailure) {
      // FIXME use true key sizes
      //var keypair = jwk.KeyPair.generate(vep.params.algorithm, vep.params.keysize);
      var keypair = jwk.KeyPair.generate(vep.params.algorithm, 64);
      Identities.certifyIdentity(email, keypair, onSuccess, onFailure);
    },

    /**
     * Add an identity to an already created account.  Sends address and 
     * keypair to the server, user then needs to verify account ownership. This 
     * does not add the new email address/keypair to the local list of 
     * valid identities.
     * @method addIdentity
     * @param {string} email - Email address.
     * @param {function} [onSuccess] - Called on successful completion. 
     * @param {function} [onFailure] - Called on error.
     */
    addIdentity: function(email, onSuccess, onFailure) {
      var self = this;
      var keypair = jwk.KeyPair.generate(vep.params.algorithm, 64);

      self.stagedEmail = email;
      self.stagedKeypair = keypair;

      // we no longer send the keypair, since we will certify it later.
      network.addEmail(email, function() {
        if (onSuccess) {
          onSuccess(keypair);
        }
      }, onFailure);
    },

    /** 
     * Persist an address and key pair locally.
     * @method persistIdentity
     * @param {string} email - Email address to persist.
     * @param {object} keypair - Key pair to save
     * @param {function} [onSuccess] - Called on successful completion. 
     * @param {function} [onFailure] - Called on error.
     */
    persistIdentity: function(email, keypair, cert, onSuccess, onFailure) {
      var new_email_obj= {
        created: new Date(),
        pub: keypair.publicKey.toSimpleObject(),
        priv: keypair.secretKey.toSimpleObject(),
        cert: cert
      };

      addEmail(email, new_email_obj);

      if (onSuccess) {
        onSuccess();
      }
    },

    /**
     * Remove an email address.
     * @method removeIdentity
     * @param {string} email - Email address to remove.
     * @param {function} [onSuccess] - Called when complete.
     * @param {function} [onFailure] - Called on failure.
     */
    removeIdentity: function(email, onSuccess, onFailure) {
      network.removeEmail(email, function() {
        removeEmail(email);
        if (onSuccess) {
          onSuccess();
        }
      }, onFailure);
    },

    /**
     * Get an assertion for an identity
     * @method getIdentityAssertion
     * @param {string} email - Email to get assertion for.
     * @param {function} [onSuccess] - Called with assertion on success.
     * @param {function} [onFailure] - Called on failure.
     */
    getIdentityAssertion: function(email, onSuccess, onFailure) {
      var storedID = Identities.getStoredIdentities()[email],
          assertion;

      if (storedID) {
        // parse the secret key
        var sk = jwk.SecretKey.fromSimpleObject(storedID.priv);
        var tok = new jwt.JWT(null, new Date(), network.origin);
        assertion = vep.bundleCertsAndAssertion([storedID.cert], tok.sign(sk));
      }

      if (onSuccess) {
        onSuccess(assertion);
      }

    },

    /**
     * Get the list of identities stored locally.
     * @method getStoredIdentities
     * @return {object} identities.
     */
    getStoredIdentities: function() {
      return getEmails();
    },

    /**
     * Clear the list of identities stored locally.
     * @method clearStoredIdentities
     */
    clearStoredIdentities: function() {
      clearEmails();
    }


  };

  return Identities;
}());
