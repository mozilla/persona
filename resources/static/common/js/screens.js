/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.Screens = (function() {
  "use strict";

  var bid = BrowserID,
      dom = BrowserID.DOM,
      renderer = bid.Renderer,
      BODY = "body";

  function Screen(target, className) {
    return {
      show: function(template, vars) {
        var self=this;

        renderer.render(target + " .contents", template, vars);
        dom.addClass(BODY, className);
        dom.fireEvent(window, "resize");

        // extendedInfo takes care of info that is on a screen but hidden by
        // default.  When the user clicks the "open extended info" button, it
        // is displayed to them.

        if (self.extendedInfo) {
          // sometimes a screen is overwritten and never hidden.  When this
          // happens, old extendedInfos need to be torn down.
          self.extendedInfo.stop();
        }
        self.extendedInfo = bid.Modules.ExtendedInfo.create();
        self.extendedInfo.start({ target: target });

        self.visible = true;
      },

      hide: function() {
        var self=this;

        dom.removeClass(BODY, className);
        dom.fireEvent(window, "resize");

        if (self.extendedInfo) {
          self.extendedInfo.stop();
          self.extendedInfo = null;
        }

        self.visible = false;
      }
    }
  }

  return {
    form: new Screen("#formWrap", "form"),
    wait: new Screen("#wait", "waiting"),
    error: new Screen("#error", "error"),
    delay: new Screen("#delay", "delay")
  };
}());
