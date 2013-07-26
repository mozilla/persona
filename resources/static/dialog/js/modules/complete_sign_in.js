/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.CompleteSignIn = (function() {
  "use strict";

  /**
   * Show the user that they are signed in and complete the dialog flow.
   * A "signing in" message is displayed, and on desktop, the arrow
   * is animated.
   */

  var bid = BrowserID,
      helpers = bid.Helpers,
      complete = helpers.complete,
      dialogHelpers = helpers.Dialog,
      sc;

  var CompleteSignIn = bid.Modules.PageModule.extend({
    start: function(options) {
      options = options || {};

      var email = options.email,
          self = this;

      self.checkRequired(options, "email");

      self.hideWait();
      // signing_in is rendered for desktop
      self.renderForm("complete_sign_in", {
        email: email
      });

      // load is rendered for mobile
      self.renderLoad("load", {
        title: gettext("signing in")
      });

      dialogHelpers.animateClose(function() {
        complete(options.ready, options.assertion);
      });
    }
  });

  sc = CompleteSignIn.sc;

  return CompleteSignIn;

}());

