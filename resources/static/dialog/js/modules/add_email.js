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
      BODY_SELECTOR = "body",
      EMAIL_SELECTOR = "#newEmail",
      SUBMIT_DISABLED_CLASS = "submit_disabled",
      CANCEL_SELECTOR = "#cancel";

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
      dom.addClass(BODY_SELECTOR, SUBMIT_DISABLED_CLASS);

      dialogHelpers.addEmail.call(self, email, function removeHint(status) {
        hideHint("addressInfo");

        // !status means there was a problem adding the email. Let the user
        // modify the email address and try to re-add.
        if (!status) {
          dom.removeAttr(EMAIL_SELECTOR, 'disabled');
          dom.removeClass(BODY_SELECTOR, SUBMIT_DISABLED_CLASS);
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

      self.click(CANCEL_SELECTOR, cancelAddEmail);
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
