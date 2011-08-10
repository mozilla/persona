(function() {
  "use strict";

  PageController.extend("addemail", {}, {
    init: function(options) {
      this._super({
        bodyTemplate: "addemail.ejs",
        bodyVars: {
          sitename: BrowserIDNetwork.origin,
          identities: getEmails()
        },
        footerTemplate: "bottom-addemail.ejs",
        footerVars: {}
      });
      // select the first option
      this.find('input:first').attr('checked', true);
    },

    submit: function() {
      // add the actual email
      // now we need to actually try to stage the creation of this account.
      var email = $("#email_input").val();
      var keypair = CryptoStubs.genKeyPair();

      // kick the user to waiting/status page while we talk to the server.
      this.doWait(BrowserIDWait.addEmail);

      var self = this;
      BrowserIDNetwork.addEmail(email, keypair, function() {
          // email successfully staged, now wait for email confirmation
          self.close("addemail:complete", {
            email: email,
            keypair: keypair
          });
        },
        function() {
          self.runErrorDialog(BrowserIDErrors.addEmail);
        });
    }
  });

}());
