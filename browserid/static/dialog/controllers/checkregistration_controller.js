(function() {
  "use strict";

  PageController.extend("Checkregistration", {}, {
    init: function(options) {
      this._super({
        bodyTemplate: "confirmemail.ejs",
        bodyVars: {
          email: options.email
        },
        footerTemplate: "bottom-confirmemail.ejs",
        footerVars: {}
      });
      $('#continue_button').addClass('disabled');
      this.setupRegCheck();
    },

    close: function() {
      if(this.pollTimeout) {
        clearTimeout(this.pollTimeout);
        this.pollTimeout = null;
      }
    },

    setupRegCheck: function() {
      // now poll every 3s waiting for the user to complete confirmation
      var self=this;
      function setupRegCheck() {
        self.pollTimeout = setTimeout(function() {
          BrowserIDNetwork.checkRegistration(function(status) {
            // registration status checks the status of the last initiated registration,
            // it's possible return values are:
            //   'complete' - registration has been completed
            //   'pending'  - a registration is in progress
            //   'noRegistration' - no registration is in progress
            if (status === 'complete') {
              // this is a secondary registration from browserid.org, persist
              // email, keypair, and that fact
              
              // and tell the user that everything is really quite awesome.
              self.find("#waiting_confirmation").hide();
              self.find("#resendit_action").hide();
              self.find("#confirmed_notice").show();

              // enable button
              $('#continue_button').removeClass('disabled');

              self.publish("checkregistration:confirmed");

            } else if (status === 'pending') {
              // try again, what else can we do?
              self.setupRegCheck();
            } else {
              runErrorDialog(BrowserIDErrors.registration);
            }
          },
          function(jqXHR, textStatus, errorThrown) {
              runErrorDialog(BrowserIDErrors.registration);
          });
        }, 3000);
      }
      
      // setup the timeout
      setupRegCheck();

    },

    validate: function() {
      return !$("#continue_button").hasClass("disabled");
    },

    submit: function() {
      var self=this;
      self._super();      
      self.publish("checkregistration:confirmed");
    }

  });



}());
