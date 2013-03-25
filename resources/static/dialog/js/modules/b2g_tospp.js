/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.B2gTosPp = (function() {
  "use strict";

  // B2G requires special TOS/PP handling. TOS/PP agreements must be shown in
  // a modal iframe instead of opening a new tab. Take care of that.

  var bid = BrowserID,
      dom = bid.DOM,
      complete = bid.Helpers.complete,
      BODY_SELECTOR = "body",
      TOSPP_SELECTOR = ".tospp a",
      TOSPP_CLOSE_SELECTOR = "#tosppmodal .close",
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
        if (dom.is(target, TOSPP_SELECTOR)) {
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
    var iframe;
    var modal;
    if (!this._tospp) {
      this._tospp = {};
      modal = this._tospp.modal = document.createElement('div');
      modal.id = 'tosppmodal';

      var closeEl = document.createElement('span');
      closeEl.className = "close";
      closeEl.innerHTML = 'X';
      closeEl.onclick = close.bind(this);
      modal.appendChild(closeEl);

      iframe = this._tospp.iframe = document.createElement('iframe');
      iframe.id = 'tosppframe';
      iframe.setAttribute('sandbox', '');
      iframe.setAttribute('name', 'tosppframe');
      dom.appendTo(iframe, modal);
      dom.appendTo(modal, IFRAME_PARENT_SELECTOR);
    } else {
      iframe = this._tospp.iframe;
      modal = this._tospp.modal;
    }
    modal.style.display = "block";
    iframe.setAttribute('src', url);
  }

  function closeTOSPP() {
    /*jshint validthis:true*/
    if (this._tospp) {
      this._tospp.modal.style.display = "none";
    }
  }

  function removeTOSPP() {
    var tosppEls = this._tospp;
    if (tosppEls) {
      dom.removeElement(tosppEls.modal);
      dom.removeElement(tosppEls.iframe);
    }
  }

  return Module;
}());

