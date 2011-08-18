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
var BrowserIDNetwork = (function() {
  var Network = {
    csrf: function(onSuccess) {
      $.get('/wsapi/csrf', {}, function(result) {
        BrowserIDNetwork.csrf_token = result;
        if(onSuccess) {
          onSuccess();
        }
      });
    },

    setOrigin: function(origin) {
      BrowserIDNetwork.origin = filterOrigin(origin);
    },

    authenticate: function(email, password, onSuccess, onFailure) {
      $.ajax({
        type: "POST",
        url: '/wsapi/authenticate_user',
        data: {
          email: email,
          pass: password,
          csrf: BrowserIDNetwork.csrf_token
        },
        success: function(status, textStatus, jqXHR) {
          if(onSuccess) {
            var authenticated = JSON.parse(status);
            onSuccess(authenticated);
          }
        },
        error: onFailure
      });
    },

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

    logout: function(onSuccess) {
      $.post("/wsapi/logout", {
        csrf: BrowserIDNetwork.csrf_token
      }, 
      function() {
        BrowserIDNetwork.csrf();
        onSuccess();
      });
    },

    stageUser: function(email, password, keypair, onSuccess, onFailure) {
      $.ajax({
          type: "post",
          url: '/wsapi/stage_user',
          data: {
            email: email,
            pass: password,
            pubkey : keypair.pub,
            site : BrowserIDNetwork.origin,
            csrf : BrowserIDNetwork.csrf_token
          },
          success: onSuccess,
          error: onFailure
        });

    },

    addEmail: function(email, keypair, onSuccess, onFailure) {
      $.ajax({
        type: 'POST',
        url: '/wsapi/add_email',
        data: {
          email: email,
          pubkey: keypair.pub,
          site: BrowserIDNetwork.origin,
          csrf: BrowserIDNetwork.csrf_token
        },
        success: onSuccess,
        error: onFailure
      });
    },

    haveEmail: function(email, onSuccess, onFailure) {
      $.ajax({
        url: '/wsapi/have_email?email=' + encodeURIComponent(email),
        success: function(data, textStatus, xhr) {
          if(onSuccess) {
            var success = !JSON.parse(data);
            onSuccess(success);
          }
        },
        error: onFailure
      });
    },

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

    setKey: function(email, keypair, onSuccess, onError) {
      $.ajax({
        type: 'POST',
        url: '/wsapi/set_key',
        data: {
          email: email,
          pubkey: keypair.pub,
          csrf: BrowserIDNetwork.csrf_token
        },
        success: onSuccess,
        error: onError
      });

    },

    syncEmails: function(issued_identities, onKeySyncSuccess, onKeySyncFailure, onSuccess, onFailure) {
      $.ajax({
        type: "POST",
        url: '/wsapi/sync_emails',
        data: {
          emails: issued_identities,
          csrf: BrowserIDNetwork.csrf_token
        },
        success: function(resp, textStatus, jqXHR) {
          // first remove idenitites that the server doesn't know about
          if (resp.unknown_emails) {
            _(resp.unknown_emails).each(function(email_address) {
                removeEmail(email_address);
              });
          }

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
              onKeySyncSuccess(email, keypair);
              addNextEmail();
            }, onKeySyncFailure);
          }

          addNextEmail();
        },
        error: onFailure
      }
    );


    }
  };

  $(function() {
    Network.csrf();
  });
  return Network;

  function filterOrigin(origin) {
    return origin.replace(/^.*:\/\//, '');
  }
}());
