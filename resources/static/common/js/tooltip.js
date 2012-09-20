/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.Tooltip = (function() {
  "use strict";

  var ANIMATION_TIME = 250,
      TOOLTIP_MIN_DISPLAY = 2000,
      READ_WPM = 200,
      bid = BrowserID,
      renderer = bid.Renderer,
      hideTimer,
      tooltip;

  function createTooltip(el) {
    tooltip = renderer.append("body", "tooltip", {
      contents: el.html()
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

  function animateTooltip(el, complete) {
    var displayTimeMS = calculateDisplayTime(el.text());

    bid.Tooltip.shown = true;
    el.fadeIn(ANIMATION_TIME, function() {
      hideTimer = setTimeout(function() {
        el.fadeOut(ANIMATION_TIME, complete);
      }, displayTimeMS);
    });

    return displayTimeMS;
  }

  function showTooltip(el, complete) {
    // Only one tooltip can be shown at a time, see issue #1615
    removeTooltips();

    // By default, the element passed in is the tooltip element.  If it has
    // a "for" attribute, that means this tooltip should be anchored to the
    // element listed in the "for" attribute. If that is the case, create a new
    // tooltip and anchor it to the other element.
    var tooltipEl = $(el),
        tooltipAnchor = tooltipEl.attr("for");

    if (tooltipAnchor) {
      // The tooltip should be anchored to another element.  Place the tooltip
      // directly above the element and remove it when it is no longer needed.
      tooltipEl = createTooltip(tooltipEl);
      anchorTooltip("#" + tooltipAnchor);
    }

    return animateTooltip(tooltipEl, function() {
      removeTooltips();
      complete && complete();
    });
  }

  function removeTooltips() {
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }

    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }

    $('.tooltip').hide();
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
