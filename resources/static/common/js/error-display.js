/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.ErrorDisplay = (function() {
  "use strict";

  var bid = BrowserID,
      dom = bid.DOM;

  function open(event) {
    event && event.preventDefault();

    /**
     * XXX What a big steaming pile, use CSS animations for this!
     */
    $("#moreInfo").slideDown(function() {
      // The expanded info may be partially obscured on mobile devices in
      // landscape mode.  Force the screen size hacks to account for the new
      // expanded size.
      dom.fireEvent(window, "resize");
    });
    $("#openMoreInfo").css({visibility: "hidden"});
  }

  function init(target) {
    dom.bindEvent("#openMoreInfo", "click", open);
    return dom.getElements(target);
  }

  function stop() {
    dom.unbindEvent("#openMoreInfo", "click", open);
  }

  return {
    start: init,
    stop: stop,
    open: open
  };

}());

