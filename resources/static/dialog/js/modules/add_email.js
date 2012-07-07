/*jshint browser:true, jquery: true, forin: true, laxbreak:true */
/*global _: true, BrowserID: true, PageController: true, gettext: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.AddEmail = (function() {
  "use strict";

  var bid = BrowserID,
      dom = bid.DOM,
      helpers = bid.Helpers,
      user = bid.User,
      dialogHelpers = helpers.Dialog,
      errors = bid.Errors,
      complete = helpers.complete,
      tooltip = bid.Tooltip,
      hints = ["addressInfo"],
      ANIMATION_TIME = 250;

  function hideHint(selector) {
    $("." + selector).hide();
  }

  function showHint(selector, callback) {
    _.each(hints, function(className) {
      if (className !== selector) {
        hideHint(className);
      }
    });

    $("." + selector).fadeIn(ANIMATION_TIME, function() {
      dom.fireEvent(window, "resize");
      complete(callback);
    });
  }

  function addEmail(callback) {
    var email = helpers.getAndValidateEmail("#newEmail"),
        self=this;

    if (email) {
      showHint("addressInfo");
      dialogHelpers.addEmail.call(self, email, function removeHint(status) {
        hideHint("addressInfo");
        complete(callback, status);
      });
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
      hideHint("addressInfo");

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
