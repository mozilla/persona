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

