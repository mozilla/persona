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

      if (self.stopped) return done && done();
      self.stopped = true;

      var anchor = self.anchor;
      if (anchor) {
        dom.unbindEvent(anchor, "keyup", self.onChange);
        dom.unbindEvent(anchor, "change", self.onChange);
      }

      self.hide(done);
    },

    show: function(done) {
      dom.slideDown(this.tooltipEl, animationTime, done);
    },

    hide: function(done) {
      var self = this,
          anchor = self.anchor;

      if (anchor) dom.removeClass(anchor, "invalid");

      dom.slideUp(self.tooltipEl, animationTime, tooltipHidden);

      function tooltipHidden() {
        // Removing the reference to the visible tooltip is taken care of here
        // because the tooltip can close itself, leaving dangling references.
        // The dangling reference makes it impossible for the same tooltip to
        // be shown, close itself, and then shown again.
        // Maybe a better solution is to make this a module and trigger an event,
        // but that will cause some circular dependencies that I'm not yet
        // ready to untangle.
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
      removeVisibleTooltip(function() {
        animationTime = ANIMATION_TIME;
        if (done) done();
      });
    }
    // END TESTING API
  };


  // Interfaces:
  // showTooltip(tooltipEl, [done])
  function showTooltip(tooltipEl, done) {
    // showing the same tooltip? abort out now.
    if (visibleTooltip && dom.is(visibleTooltip.tooltipEl, tooltipEl))
      return done && done();

    // Only one tooltip can be shown at a time, see issue #1615
    removeVisibleTooltip(function() {
      visibleTooltip = new Tooltip();
      visibleTooltip.start({
        tooltipEl: tooltipEl,
        done: done
      });
    });

  }

  function removeVisibleTooltip(done) {
    if (visibleTooltip) {
      visibleTooltip.stop(done);
    }
    else if (done) {
      done();
    }
  }

  function isTooltipVisible() {
    return !!(visibleTooltip && !visibleTooltip.stopped);
  }

}());
