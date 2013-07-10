/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.Tooltip = (function() {
  "use strict";

  var ANIMATION_TIME = 250,
      animationTime = ANIMATION_TIME,
      bid = BrowserID,
      dom = bid.DOM,
      renderer = bid.Renderer,
      visibleTooltip;

  // This file is made up of two parts, the first part is the Tooltip generic
  // object type, the second half is the BrowserID.Tooltip singleton logic.


  // Tooltip generic object type.
  var Tooltip = function() {};
  _.extend(Tooltip.prototype, {
    start: function(options) {
      var self = this;

      var tooltipEl = self.tooltipEl = options.tooltipEl;
      var anchor = dom.getAttr(tooltipEl, "for");

      if (anchor) {
        anchor = "#" + anchor;
        self.anchor = anchor;
        self.lastVal = dom.getInner(anchor).trim() || "";

        self.onChange = onChange.bind(self);

        // if the anchor input element changes or has a key pressed in it,
        // clear the tooltip.
        dom.bindEvent(anchor, "keyup", self.onChange);
        dom.bindEvent(anchor, "change", self.onChange);

        dom.addClass(anchor, "invalid");
      }

      self.show(options.done);
    },

    stop: function(done) {
      var self = this;

      if (self.stopped) return;
      self.stopped = true;

      var anchor = self.anchor;
      if (anchor) {
        dom.unbindEvent(anchor, "keyup", self.onChange);
        dom.unbindEvent(anchor, "change", self.onChange);
      }

      self.hide(done);
    },

    show: function(done) {
      var tooltipEl = this.tooltipEl;

      dom.stopAnimations(tooltipEl);
      if (animationTime) {
        // If tooltipEl does not exist in the DOM, jQuery never calls the
        // slideDown done function. Avoid the blowup by using a setTimeout.
        dom.slideDown(tooltipEl, animationTime);
        if (done) setTimeout(done, animationTime);
      }
      else {
        dom.show(tooltipEl);
        if (done) done();
      }
    },

    hide: function(done) {
      var self = this,
          tooltipEl = self.tooltipEl,
          anchor = self.anchor;

      if (anchor) dom.removeClass(anchor, "invalid");

      dom.stopAnimations(tooltipEl);

      if (animationTime) {
        dom.slideUp(tooltipEl, animationTime);
        // If tooltipEl does not exist in the DOM, jQuery never calls the
        // slideUp done function. Avoid the blowup by using a setTimeout.
        setTimeout(animationComplete, animationTime);
      }
      else {
        dom.hide(tooltipEl);
        animationComplete();
      }

      function animationComplete() {
        if (visibleTooltip === self) visibleTooltip = null;
        if (done) done();
      }
    }
  });

  function onChange(event) {
    /*jshint validthis: true*/
    var self = this;

    var val = dom.getInner(event.target).trim();
    var lastVal = self.lastVal;
    self.lastVal = val;
    if (val !== lastVal) {
      self.stop();
    }
  }

  // BrowserID.Tooltip singleton public interface.

  return {
    // showTooltip(tooltipEl, [done])
    showTooltip: showTooltip
    // BEGIN TESTING API
    ,
    visible: isTooltipVisible,
    init: function(options) {
      animationTime = options.animationTime;
    },
    reset: function(done) {
      removeVisibleTooltip(done);
      animationTime = ANIMATION_TIME;
    }
    // END TESTING API
  };


  // Interfaces:
  // showTooltip(tooltipEl, [done])
  function showTooltip(tooltipEl, done) {
    // showing the same tooltip? abort out now.
    if (visibleTooltip && $(visibleTooltip.tooltipEl).is(tooltipEl))
      return done && done();

    // Only one tooltip can be shown at a time, see issue #1615
    removeVisibleTooltip();

    visibleTooltip = new Tooltip();
    visibleTooltip.start({
      tooltipEl: tooltipEl,
      done: done
    });
  }

  function removeVisibleTooltip(done) {
    if (visibleTooltip) {
      visibleTooltip.stop(done);
    }
  }

  function isTooltipVisible() {
    return !!visibleTooltip;
  }

}());
