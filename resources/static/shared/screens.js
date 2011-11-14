BrowserID.Screens = (function() {
  "use strict";

  var bid = BrowserID,
      dom = BrowserID.DOM,
      renderer = bid.Renderer;

  function render(target, body, vars) {
    renderer.render(target + " .contents", body, vars);
  }

  function form(template, vars) {
    render("#formWrap", template, vars);
    dom.removeClass("body", "error");
    dom.removeClass("body", "waiting");
    dom.addClass("body", "form");
  }

  function wait(template, vars) {
    render("#wait", template, vars);
    dom.removeClass("body", "error");
    dom.removeClass("body", "form");
    dom.addClass("body", "waiting");
  }

  function error(template, vars) {
    render("#error", template, vars);
    dom.removeClass("body", "waiting");
    dom.removeClass("body", "form");
    dom.addClass("body", "error");

    bid.ErrorDisplay.start("#error");
  }

  return {
    form: form,
    wait: wait,
    error: error
  };
}());
