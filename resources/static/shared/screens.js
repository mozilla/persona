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
