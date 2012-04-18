/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global _: true, BrowserID: true, PageController: true, gettext: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.AddEmail = (function() {
  "use strict";

  var bid = BrowserID,
      helpers = bid.Helpers,
      user = bid.User,
      dialogHelpers = helpers.Dialog,
      errors = bid.Errors,
      complete = helpers.complete,
      tooltip = bid.Tooltip;

  function addEmail(callback) {
    var email = helpers.getAndValidateEmail("#newEmail"),
        self=this;

    if (email) {
      dialogHelpers.addEmail.call(self, email, callback);
    }
    else {
      complete(callback, false);
    }
  }


  function cancelAddEmail() {
    this.close("cancel_state");
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      var self=this,
          originEmail = user.getOriginEmail();

      self.renderDialog("add_email", options);

      // Only show the RP's TOS/PP if the user has not been to this site
      // before.
      if(!originEmail && options.siteTOSPP) {
        dialogHelpers.showRPTosPP.call(self);
      }

      self.click("#cancel", cancelAddEmail);
      Module.sc.start.call(self, options);
    },
    submit: addEmail
    // BEGIN TESTING API
    ,
    addEmail: addEmail,
    cancelAddEmail: cancelAddEmail
    // END TESTING API
  });

  return Module;

}());
