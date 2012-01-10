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
        renderer.render(target + " .contents", template, vars);
        dom.addClass(BODY, className);
        this.visible = true;
      },

      hide: function() {
        dom.removeClass(BODY, className);
        this.visible = false;
      }
    }
  }


  return {
    form: new Screen("#formWrap", "form"),
    wait: new Screen("#wait", "waiting"),
    error: new Screen("#error", "error")
  };
}());
