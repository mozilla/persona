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
      dom = bid.DOM,
      // Give a little delay before starting the animation or the dialog
      // appears jerky. Assertion generation (jwcrypto doesn't yield the UI
      // thread) is the main suspect here.
      DELAY_BEFORE_ANIMATION_BEGINS = 750,
      // Give a little delay after finishing the animation (750ms, see
      // style.css) or else the dialog appears jerky.
      DELAY_AFTER_ANIMATION_BEGINS_BEFORE_CLOSE = 1750,
      // This is a magic number, it is the same width as the arrow. See
      // resources/static/dialog/css/style.css #signIn for the arrow width.
      ARROW_WIDTH = 136,
      sc;

  var CompleteSignIn = bid.Modules.PageModule.extend({
    start: function(options) {
      options = options || {};

      var email = options.email,
          self = this;

      self.checkRequired(options, "email");

      sc.start.call(self, options);

      self.hideWait();
      // signing_in is rendered for desktop
      self.renderForm("complete_sign_in", {
        email: email
      });

      // load is rendered for mobile
      self.renderLoad("load", {
        title: gettext("signing in")
      });

      animateClose.call(self, options.ready);
    },

    stop: function() {
      var self = this;
      if (self.startAnimationTimeout) {
        clearTimeout(self.startAnimationTimeout);
        self.startAnimationTimeout = null;
      }

      if (self.closeTimeout) {
        clearTimeout(self.closeTimeout);
        self.closeTimeout = null;
      }

      dom.removeClass("body", "completing");

      sc.stop.call(self);
    }
  });

  sc = CompleteSignIn.sc;

  function animateClose(callback) {
    /*jshint validthis: true*/
    var self = this,
        bodyWidth = dom.getInnerWidth("body"),
        doAnimation = dom.exists("#signIn") && bodyWidth > 640;

    if (!doAnimation) return complete(callback);

    self.startAnimationTimeout = setTimeout(function() {
      // Force the arrow to slide all the way off the screen.
      var endWidth = bodyWidth + ARROW_WIDTH;

      dom.addClass("body", "completing");
      /**
       * CSS transitions are used to do the slide effect. jQuery has a bug
       * where it does not do transitions correctly if the box-sizing is set to
       * border-box and the element has a padding
       */
      dom.setStyle("#signIn", "width", endWidth + "px");

      self.closeTimeout = setTimeout(complete.curry(callback),
                              DELAY_AFTER_ANIMATION_BEGINS_BEFORE_CLOSE);
    }, DELAY_BEFORE_ANIMATION_BEGINS);
  }

  return CompleteSignIn;

}());

