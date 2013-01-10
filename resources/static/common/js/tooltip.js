/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.Tooltip = (function() {
  "use strict";

  var ANIMATION_TIME = 250,
      TOOLTIP_MIN_DISPLAY = 2000,
      READ_WPM = 200,
      bid = BrowserID,
      dom = bid.DOM,
      renderer = bid.Renderer,
      hideTimer,
      tooltip;

  function createTooltip(tooltipText) {
    // There is only one global tooltip, update its reference to the new
    // tooltip. All other tooltips should have been removed by this point.
    tooltip = renderer.append("body", "tooltip", {
      contents: tooltipText
    });

    return tooltip;
  }

  function anchorTooltip(target) {
    target = $(target);
    var targetOffset = target.offset();
    targetOffset.top -= (tooltip.outerHeight() + 5);
    targetOffset.left += 10;

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

  function animateTooltip(complete) {
    var displayTimeMS = calculateDisplayTime(tooltip.text());

    bid.Tooltip.shown = true;
    tooltip.fadeIn(ANIMATION_TIME, function() {
      hideTimer = setTimeout(function() {
        tooltip.fadeOut(ANIMATION_TIME, complete);
      }, displayTimeMS);
    });

    return displayTimeMS;
  }

  function showTooltipString(tooltipText, tooltipAnchor, complete) {
    createTooltip(tooltipText);
    anchorTooltip(tooltipAnchor);

    return animateTooltip(function() {
      removeTooltips();
      complete && complete();
    });
  }

  // Interfaces:
  // showTooltip(tooltipEl, [complete])
  // showTooltip(tooltipText, tooltipAnchor, [complete])
  function showTooltip(tooltipText, tooltipAnchor, complete) {
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

    // Only one tooltip can be shown at a time, see issue #1615
    removeTooltips();


    return showTooltipString(tooltipText, tooltipAnchor, complete);
  }

  function removeTooltips() {
    if (tooltip) {
      dom.removeElement(tooltip);
      tooltip = null;
    }

    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }

    dom.hide('.tooltip');
    bid.Tooltip.shown = false;
  }


 return {
   showTooltip: showTooltip
   // BEGIN TESTING API
   ,
   reset: removeTooltips
   // END TESTING API
 };

}());
