/*jshint browsers:true, forin: true, laxbreak: true */
/*global _: true, console: true, addEmail: true, removeEmail: true, CryptoStubs: true */
"use strict";
var BrowserIDNetwork = (function() {
  var Network = {
    csrf: function(onSuccess) {
      $.get('/csrf', {}, function(result) {
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
          emails: JSON.stringify(issued_identities),
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

  Network.csrf();
  return Network;

  function filterOrigin(origin) {
    return origin.replace(/^.*:\/\//, '');
  }
}());
