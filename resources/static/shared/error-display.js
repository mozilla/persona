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
    $("#moreInfo").slideDown();
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

