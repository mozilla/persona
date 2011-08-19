/*jshint browsers:true, forin: true, laxbreak: true */
/*global _: true, console: true, addEmail: true, removeEmail: true, CryptoStubs: true */
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
"use strict";
var BrowserIDIdentities = (function() {
  function getIssuedIdentities() {
      var emails = getEmails();
      var issued_identities = {};
      _(emails).each(function(email_obj, email_address) {
        issued_identities[email_address] = email_obj.pub;
      });

      return issued_identities;
  }

  function removeUnknownIdentities(unknown_emails) {
    // first remove idenitites that the server doesn't know about
    if (unknown_emails) {
      _(unknown_emails).each(function(email_address) {
        removeEmail(email_address);
      });
    }
  }

  var Identities = {
    syncIdentities: function(onSuccess, onFailure, onKeySyncFailure) {
      var issued_identities = getIssuedIdentities();

      // send up all email/pubkey pairs to the server, it will response with a
      // list of emails that need new keys.  This may include emails in the
      // sent list, and also may include identities registered on other devices.
      // we'll go through the list and generate new keypairs
      
      // identities that don't have an issuer are primary authentications,
      // and we don't need to worry about rekeying them.

      var self = this;
      BrowserIDNetwork.syncEmails(issued_identities, function(resp) {
        removeUnknownIdentities(resp.unknown_emails);

        // now let's begin iteratively re-keying the emails mentioned in the server provided list
        var emailsToAdd = resp.key_refresh;
        
        function addNextEmail() {
          if (!emailsToAdd || !emailsToAdd.length) {
            onSuccess();
            return;
          }

          // pop the first email from the list
          var email = emailsToAdd.shift();
          var keypair = CryptoStubs.genKeyPair();

          BrowserIDNetwork.setKey(email, keypair, function() {
            // update emails list and commit to local storage, then go do the next email
            self.addIdentity(email, keypair, "browserid.org:443");
            addNextEmail();
          }, onKeySyncFailure);
        }

        addNextEmail();
      }, onFailure);
    },

    /**
     * Persist an address and key pair.
     * @method addIdentity
     * @param {string} email - Email address.
     * @param {object} keypair - Keypair for email address
     * @param {string} [issuer] - Issuer of keypair
     */
    addIdentity: function(email, keypair, issuer) {
      var new_email_obj= {
        created: new Date(),
        pub: keypair.pub,
        priv: keypair.priv
      };

      if (issuer) {
        new_email_obj.issuer = issuer;
      }
      
      addEmail(email, new_email_obj);
    },

    /**
     * Remove an email address.
     * @method removeIdentity
     * @param {string} email - Email address to remove.
     */
    removeIdentity: function(email) {
      removeEmail(email);
    },

    /**
     * Get the current list of stored identities.
     * @method getIdentities
     * @return {object} identities.
     */
    getIdentities: function() {
      return getEmails();
    }


  };

  return Identities;
}());
