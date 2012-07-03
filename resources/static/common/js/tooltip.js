/*jshint browser:true, jquery: true, forin: true, laxbreak:true */
/*globals BrowserID: true, _:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.Tooltip = (function() {
  "use strict";

  var ANIMATION_TIME = 250,
      TOOLTIP_DISPLAY = 2000,
      READ_WPM = 200,
      bid = BrowserID,
      dom = bid.DOM,
      renderer = bid.Renderer,
      hideTimer;

  function createTooltip(el) {
      var contents = el.html();

      var tooltip = renderer.append("body", "tooltip", {
        contents: contents
      });

      return tooltip;
  }

  function positionTooltip(tooltip, target) {
    var targetOffset = target.offset();
    targetOffset.top -= (tooltip.outerHeight() + 5);
    targetOffset.left += 10;

    tooltip.css(targetOffset);
  }

  function animateTooltip(el, complete) {
    var contents = el.text().replace(/\s+/, ' ').replace(/^\s+/, '').replace(/\s+$/, '');
    var words = contents.split(' ').length;

    // The average person can read ± 250 wpm.
    var wordTimeMS = (words / READ_WPM) * 60 * 1000;
    var displayTimeMS = Math.max(wordTimeMS, TOOLTIP_DISPLAY);

    bid.Tooltip.shown = true;
    el.fadeIn(ANIMATION_TIME, function() {
      hideTimer = setTimeout(function() {
        el.fadeOut(ANIMATION_TIME, function() {
          bid.Tooltip.shown = false;
          if(complete) complete();
        });
      }, displayTimeMS);
    });
  }

  function createAndShowRelatedTooltip(el, relatedTo, complete) {
      // This means create a copy of the tooltip element and position it in
      // relation to an element.  Right now we are putting the tooltip directly
      // above the element.  Once the tooltip is no longer needed, remove it
      // from the DOM.
      var tooltip = createTooltip(el);

      var target = $("#" + relatedTo);
      positionTooltip(tooltip, target);

      animateTooltip(tooltip, function() {
        if (tooltip) {
          tooltip.remove();
          tooltip = null;
        }
        if (complete) complete();
      });
  }

  function showTooltip(el, complete) {
    el = $(el);
    var messageFor = el.attr("for");

    // First, see if we are "for" another element, if we are, create a copy of
    // the tooltip to attach to the element.
    if(messageFor) {
      createAndShowRelatedTooltip(el, messageFor, complete);
    }
    else {
      animateTooltip(el, complete);
    }
  }


 return {
   showTooltip: showTooltip
   // BEGIN TESTING API
   ,
   reset: function() {
     if(hideTimer) {
       clearTimeout(hideTimer);
       hideTimer = null;
     }

     $(".tooltip").hide();
     bid.Tooltip.shown = false;
   }
   // END TESTING API
 };

}());
