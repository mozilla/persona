/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.InlineTosPp = (function() {
  "use strict";

  // B2G requires special TOS/PP handling. TOS/PP agreements must be shown in
  // a modal iframe instead of opening a new tab. Take care of that.

  var bid = BrowserID,
      dom = bid.DOM,
      renderer = bid.Renderer,
      complete = bid.Helpers.complete,
      BODY_SELECTOR = "body",
      TOSPP_OPENER_SELECTOR = ".tospp a",
      TOSPP_SELECTOR = "#tosppmodal",
      TOSPP_CLOSE_SELECTOR = "#tosppmodal",
      TOSPP_IFRAME = "#tosppframe",
      IFRAME_PARENT_SELECTOR = "body",
      sc;

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      options = options || {};

      var self=this;

      sc.start.call(self, options);

      // Use event propagation to avoid using jQuery .live events directly.
      self.bind(BODY_SELECTOR, 'click', function(event) {
        var target = event.target;
        if (dom.is(target, TOSPP_OPENER_SELECTOR)) {
          event.preventDefault();
          showTOSPP.call(self, target.href);
        }
      });

      complete(options.ready);
    },

    stop: function() {
      removeTOSPP.call(this);
      sc.stop.call(this);
    },

    // BEGIN TESTING API
    show: showTOSPP,
    close: closeTOSPP,
    remove: removeTOSPP
    // END TESTING API
  });

  sc = Module.sc;

  function showTOSPP(url) {
    /*jshint validthis:true*/
    var self=this;

    if (!self._tospp) {
      self._tospp = renderer.append(IFRAME_PARENT_SELECTOR, "inline_tospp", {
        no_iframe: self.options.no_iframe
      });
      self.click(TOSPP_CLOSE_SELECTOR, closeTOSPP, self);
    }

    dom.setAttr(TOSPP_IFRAME, 'src', url);
    dom.show(TOSPP_SELECTOR);
  }

  function closeTOSPP() {
    /*jshint validthis:true*/
    if (this._tospp) {
      dom.hide(TOSPP_SELECTOR);
    }
  }

  function removeTOSPP() {
    /*jshint validthis: true*/
    var tosppEl = this._tospp;
    if (tosppEl) {
      dom.removeElement(tosppEl);
    }
  }

  return Module;
}());

