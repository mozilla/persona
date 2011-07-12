//
// a JMVC controller for the browserid dialog
//

$.Controller("Dialog", {}, {
    init: function(el) {
      var chan = setupChannel(this);
      
      this.element.html("views/body.ejs", {});
      this.element.show();
    },
      
    getVerifiedEmail: function(remoteOrigin, onsuccess, onerror) {
      // check to see if there's any pubkeys stored in the browser
      var haveIDs = _.keys(getEmails()).length > 0;
      var self = this;

      // wherever shall we start?
      if (haveIDs) {
        this.doSignIn(remoteOrigin, onsuccess, onerror);
      } else {
        // do we even need to authenticate?
        this.checkAuth(function() {
            self.syncIdentities(onsuccess, onerror);
          }, function() {
            self.doAuthenticate(remoteOrigin, onsuccess, onerror);
          }, onsuccess, onerror);
      }
    },
      
    doSignIn: function(remoteOrigin, onsuccess, onerror) {
      $('#dialog').html("views/signin.ejs", {});
    },

    doAuthenticate: function(remoteOrigin, onsuccess, onerror) {
      $('#dialog').html("views/authenticate.ejs", {sitename: remoteOrigin});      
    },

    doWait: function(title, message, onsuccess, onerror) {
      $('#dialog').html("views/wait.ejs", {title: title, message: message});      
    },

    checkAuth: function(authcb, notauthcb, onsuccess, onerror) {
      this.doWait("Communicating with server",
             "Just a moment while we talk with the server.",
             onsuccess, onerror);
      
      $.ajax({
          url: '/wsapi/am_authed',
            success: function(status, textStatus, jqXHR) {
            var authenticated = JSON.parse(status);
            if (!authenticated) {
              notauthcb();
            } else {
              authcb();
            }
          },
            error: function() {
            runErrorDialog(
                           "serverError",
                           "Error Communicating With Server!",
                           "There was a technical problem while trying to log you in.  Yucky!",
                           onsuccess, onerror);
          }
        });
  }

  });