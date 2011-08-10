(function() {
  "use strict";

  PageController.extend("Chooseemail", {}, {
    init: function(options) {
      this._super({
        bodyTemplate: "signin.ejs",
        bodyVars: {
          sitename: BrowserIDNetwork.origin,
          identities: getEmails()
        },
        footerTemplate: "bottom-pickemail.ejs",
        footerVars: {}
      });
      // select the first option
      this.find('input:first').attr('checked', true);
    },

    submit: function() {
      var email = $("#identities input:checked").val();
      this.close("chooseemail:complete", {
        email: email
      });
    },

    "#addemail click": function(event) {
      this.close("chooseemail:addemail");
    },

    "#notme click": function(event) {
      this.close("chooseemail:notme");
    }
  });

}());
