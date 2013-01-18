/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.Tooltip = (function() {
  "use strict";

  var ANIMATION_TIME = 250,
      TOOLTIP_MIN_DISPLAY = 2000,
      TOOLTIP_OFFSET_TOP_PX = 5,
      TOOLTIP_OFFSET_LEFT_PX = 10,
      READ_WPM = 200,
      bid = BrowserID,
      dom = bid.DOM,
      renderer = bid.Renderer,
      onlyAttachedTooltip;

  // This file is made up of two parts, the first part is the Tooltip generic
  // object type, the second half is the BrowserID.Tooltip singleton logic.


  // Tooltip generic object type.
  var Tooltip = function() {};
  _.extend(Tooltip.prototype, {
    start: function(options) {
      var self = this;

      self.tooltipEl = renderer.append("body", "tooltip", {
        contents: options.text
      });

      anchorTooltip(self.tooltipEl, options.anchor);

      // return the displayTimeMS that animateTooltip returns - the
      // unit tests expect them.
      return this.animateTooltip(options.done);
    },

    stop: function() {
      // stop any fadeIn animations that are occurring. This prevents
      // the fadeIn completion callback from being invoked for the tooltip
      // after stop is called.
      var self = this;
      dom.stopAnimations(self.tooltipEl);
      dom.hide(self.tooltipEl);
      dom.removeElement(self.tooltipEl);
      self.tooltipEl = null;

      if (self.hideTimer) {
        clearTimeout(self.hideTimer);
        self.hideTimer = null;
      }
    },

    animateTooltip: function(complete) {
      var self = this,
          tooltip = self.tooltipEl,
          displayTimeMS = calculateDisplayTime(tooltip.text());

      // The animation will be stopped for 'this' tooltip if stop is invoked.
      dom.fadeIn(tooltip, ANIMATION_TIME, function() {
        self.hideTimer = setTimeout(function() {
          dom.fadeOut(tooltip, ANIMATION_TIME, complete);
        }, displayTimeMS);
      });

      return displayTimeMS;
    }
  });

  function anchorTooltip(tooltip, target) {
    target = $(target);
    var targetOffset = target.offset();
    targetOffset.top -= (tooltip.outerHeight() + TOOLTIP_OFFSET_TOP_PX);
    targetOffset.left += TOOLTIP_OFFSET_LEFT_PX;

    tooltip.css(targetOffset);
  }

  function calculateDisplayTime(text) {
    // Calculate the amount of time a tooltip should display based on the
    // number of words in the content divided by the number of words an average
    // person can read per minute.
    var contents = text.replace(/\s+/, ' ').trim(),
        words = contents.split(' ').length,
        // The average person can read ± 250 wpm.
        wordTimeMS = (words / READ_WPM) * 60 * 1000,
        displayTimeMS = Math.max(wordTimeMS, TOOLTIP_MIN_DISPLAY);

        return displayTimeMS;
  }



  // BrowserID.Tooltip singleton public interface.

  return {
    // Interfaces:
    // showTooltip(tooltipEl, [complete])
    // showTooltip(tooltipText, tooltipAnchor, [complete])
    showTooltip: showTooltip
    // BEGIN TESTING API
    ,
    visible: isTooltipVisible,
    reset: removeAttachedTooltip
    // END TESTING API
  };


  // Interfaces:
  // showTooltip(tooltipEl, [complete])
  // showTooltip(tooltipText, tooltipAnchor, [complete])
  function showTooltip(tooltipText, tooltipAnchor, complete) {
    // Only one tooltip can be shown at a time, see issue #1615
    removeAttachedTooltip();

    onlyAttachedTooltip = new Tooltip();
    var tooltipConfig = getTooltipConfig(tooltipText, tooltipAnchor, complete);
    var displayTimeMS = onlyAttachedTooltip.start(tooltipConfig);

    return displayTimeMS;
  }

  function getTooltipConfig(tooltipText, tooltipAnchor, complete) {
    // look at tooltipText because complete is optional
    var getContentFromDOM = !complete && typeof tooltipAnchor !== "string";
    if (getContentFromDOM) {
      var tooltipEl = tooltipText;
      complete = tooltipAnchor;

      // By default, the element passed in is the tooltip element.  If it has
      // a "for" attribute, that means this tooltip should be anchored to the
      // element listed in the "for" attribute. If that is the case, create a new
      // tooltip and anchor it to the other element.
      tooltipAnchor = dom.hasAttr(tooltipEl, "for") ? "#" + dom.getAttr(tooltipEl, "for") : "body";
      tooltipText = dom.getInner(tooltipEl);
    }

    return {
      text: tooltipText,
      anchor: tooltipAnchor,
      done: complete
    };
  }


  function removeAttachedTooltip() {
    if (onlyAttachedTooltip) {
      onlyAttachedTooltip.stop();
      onlyAttachedTooltip = null;
    }
  }

  function isTooltipVisible() {
    return !!onlyAttachedTooltip;
  }

}());
