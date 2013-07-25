/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.GenerateAssertion = (function() {
  "use strict";

  var bid = BrowserID,
      dialogHelpers = bid.Helpers.Dialog,
      DELAY_BEFORE_ASSERTION_GENERATION = 750,
      sc;

  var GenerateAssertion = bid.Modules.PageModule.extend({
    start: function(options) {
      var email = options.email,
          delay = options.delay || DELAY_BEFORE_ASSERTION_GENERATION,
          self=this;

      self.checkRequired(options, "email");

      // signing_in is rendered for desktop
      self.renderForm("signing_in", {
        email: email
      });

      // load is rendered for mobile
      self.renderLoad("load", {
        title: gettext("signing in")
      });

      self.getAssertionTimeout = setTimeout(function() {
        dialogHelpers.getAssertion.call(self, email, options.ready);
      }, delay);
      sc.start.call(self, options);
    },

    stop: function() {
      clearTimeout(this.getAssertionTimeout);
      sc.stop.call(this);
    }
  });

  sc = GenerateAssertion.sc;

  return GenerateAssertion;

}());

