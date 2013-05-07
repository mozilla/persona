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
      ANIMATION_TIME = 250,
      EMAIL_SELECTOR = "#newEmail";

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
    /*jshint validthis:true*/
    var email = helpers.getAndValidateEmail(EMAIL_SELECTOR),
        self=this;

    if (email) {
      showHint("addressInfo");
      dom.setAttr(EMAIL_SELECTOR, 'disabled', 'disabled');
      dom.addClass("body", "submit_disabled");
      dialogHelpers.addEmail.call(self, email, function removeHint(status) {
        if (!status) {
          hideHint("addressInfo");
          dom.removeAttr(EMAIL_SELECTOR, 'disabled');
          dom.removeClass("body", "submit_disabled");
        }
        complete(callback, status);
      });
    }
    else {
      complete(callback, false);
    }
  }


  function cancelAddEmail() {
    /*jshint validthis:true*/
    this.close("cancel_state");
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      var self=this,
          originEmail = user.getOriginEmail();

      self.renderForm("add_email", options);
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
