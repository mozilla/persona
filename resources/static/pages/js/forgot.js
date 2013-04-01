/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.forgot = (function() {
  "use strict";

  var bid = BrowserID,
      user = bid.User,
      helpers = bid.Helpers,
      complete = helpers.complete,
      validation = bid.Validation,
      pageHelpers = bid.PageHelpers,
      cancelEvent = pageHelpers.cancelEvent,
      dom = bid.DOM,
      tooltip = bid.Tooltip;

  function submit(oncomplete) {
    dom.hide(".notification");

    var email = helpers.getAndValidateEmail("#email");
    if (!email) return complete(oncomplete);

    user.requestPasswordReset(email, function onSuccess(info) {
      if (info.success) {
        pageHelpers.emailSent("waitForPasswordResetComplete", email, oncomplete);
      }
      else {
        var tooltipEls = {
          throttle: "#could_not_add",
          invalid_email: "#not_registered",
          primary_address: "#primary_address"
        };

        var tooltipEl = tooltipEls[info.reason];
        if (tooltipEl) {
          tooltip.showTooltip(tooltipEl);
        }
        complete(oncomplete);
      }
    }, pageHelpers.getFailure(bid.Errors.requestPasswordReset, oncomplete));
  }

  function back(oncomplete) {
    pageHelpers.cancelEmailSent(oncomplete);
  }

  function redirectIfNeeded(doc, ready) {
    // email addresses are stored if the user is coming from the signin or
    // signup page.  If no email address is stored, the user browsed here
    // directly.  If the user browsed here directly, kick them back to the
    // sign in page.
    var email = pageHelpers.getStoredEmail();
    if (!email) {
      doc.location.href = "/signin";
      complete(ready);
      return;
    }

    // We know an email address was stored, now check if it is registered.  If
    // it is not registered, or is a primary, kick them over to the signin page.
    user.addressInfo(email, function(info) {
      if (info.state === "unknown" || info.type === "primary") {
        doc.location.href="/signin";
      }

      complete(ready);
    });
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      options = options || {};

      var self=this,
          doc = options.document || document;

      // Check whether a redirection needs to happen before showing the rest of
      // the content.
      redirectIfNeeded(doc, function() {
        dom.focus("form input[autofocus]");

        pageHelpers.setupEmail();

        self.bind("form", "submit", cancelEvent(submit));
        self.click("#back", back);

        Module.sc.init.call(self, options);

        complete(options.ready);
      });
    }

    // BEGIN TESTING API
    ,
    submit: submit,
    back: back
    // END TESTING API
  });

  return Module;

}());

