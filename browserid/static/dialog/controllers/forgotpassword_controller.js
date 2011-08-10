(function() {
  "use strict";

  PageController.extend("Forgotpassword", {}, {
      init: function() {
        this._super({
          bodyTemplate: "forgotpassword.ejs",
          bodyVars: {},
          footerTemplate: "bottom-continue.ejs",
          footerVars: {}
        });

        $("#create_continue").addClass("disabled");
        
        this.setupWatchers();
      },

      setupWatchers: function() {
        var self=this;
        function checkInput() {
          var pass = $("#password_input").val();
          var match = pass === $("#password_verify_input").val();
          self.find(".passwordnote").hide();
          $("#create_continue").addClass("disabled");
          if (!match) {
            self.find("#passwords_different").show();
          } else {
            if (!pass) {
              self.find("#enter_a_password").show();
            } else if (pass.length < 5) {
              self.find("#password_too_short").show();
            } else {
              self.find("#password_ok").show();
              $("#create_continue").removeClass("disabled");
            }
          }
        }
        
        // watch input dialogs
        self.find("input").unbind("keyup").bind("keyup", checkInput);
        
        // do a check at load time, in case the user is using the back button (enables the continue button!)
        checkInput();

      },

      validate: function() {
        if ($("#create_continue").hasClass("disabled"))
          return false;
        return true;
      },

      submit: function() {
        // now we need to actually try to stage the creation of this account.
        var email = this.find("#email_input").val();
        var pass = this.find("#password_input").val();
        var keypair = CryptoStubs.genKeyPair();

        this.doWait(BrowserIDWait.createAccount);

        var self = this;
        BrowserIDNetwork.stageUser(email, pass, keypair, function() {
            self.close("createaccount:created", {
              email: email,
              keypair: keypair
            });
          },
          function() {
            self.runErrorDialog(BrowserIDErrors.createAccount);
          }
        );
      }

  });

}());


