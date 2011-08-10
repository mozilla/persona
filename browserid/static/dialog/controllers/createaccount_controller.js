(function() {
  "use strict";

  PageController.extend("Createaccount", {}, {
    init: function() {
      this._super({
        bodyTemplate: "create.ejs",
        bodyVars: {},
        footerTemplate: "bottom-continue.ejs",
        footerVars: {}
      });

      $('#create_continue').addClass('disabled');

      // watch input dialogs
      this.setupWatchers();      
    },

    validate: function() {
      if ($('#create_continue').hasClass('disabled'))
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

      
    },

    setupWatchers: function() {
      var checkedEmails = {};
      var emailCheckState = null;
      var nextEmailToCheck = null;
      var self = this;

      function checkInput() {
        // check the email address
        var email = self.find("#email_input").val();

        if (typeof email === 'string' && email.length) {
          var valid = checkedEmails[email];
          if (typeof valid === 'string') {
            // oh noes.  we tried to check this email, but it failed.  let's just not tell the
            // user anything, cause this is a non-critical issue
          } else if (typeof valid === 'boolean') {
            if (valid) {
              self.find("#email_input_note").show();
              self.find("#emailinuse_message").hide();
            } else {
              $("#emailinuse_message").fadeIn(300);
              self.find("#email_input_note").hide();
              $("#in_use_email").text(email);
            }
          } else {
            // this is an email that needs to be checked!
            if (emailCheckState !== 'querying') {
              if (emailCheckState) {
                window.clearTimeout(emailCheckState);
              }
              emailCheckState = setTimeout(function() {
                emailCheckState = 'querying';
                var checkingNow = nextEmailToCheck;
                // bounce off the server and enter the 'querying' state
                BrowserIDNetwork.haveEmail(checkingNow, function(success) {
                      checkedEmails[checkingNow] = success;
                      emailCheckState = undefined;
                      checkInput();
                    },function() {
                      // some kind of error was encountered.  This is non-critical, we'll simply ignore it
                      // and mark this email check as failed.
                      checkedEmails[checkingNow] = "server failed";
                      emailCheckState = undefined;
                      checkInput();
                    }
                  );
                }, 700);
            } else {
              // FIXME: not sure when this comes up, not refactored
              // $("#create_dialog div.note:eq(0)").html($('<span class="warning"/>').text("Checking address"));
            }
          }
          nextEmailToCheck = email;
        }
      
        // next let's check the password entry
        var pass = $("#password_input").val();
        var match = pass === $("#password_verify_input").val();
        self.find('.passwordnote').hide();
        $('#create_continue').addClass('disabled');
        if (!match) {
          self.find('#passwords_different').show();
        } else {
          if (!pass) {
            self.find('#enter_a_password').show();
          } else if (pass.length < 5) {
            self.find('#password_too_short').show();
          } else {
            self.find('#password_ok').show();
            $('#create_continue').removeClass('disabled');
          }
        }
      }

      self.find("input").unbind('keyup').bind('keyup', checkInput);
      // do a check at load time, in case the user is using the back button (enables the continue button!)
      checkInput();
    },

    "#suggest_signin click": function(event) {
      this.close("createaccount:signin");
    }

  });

}());
