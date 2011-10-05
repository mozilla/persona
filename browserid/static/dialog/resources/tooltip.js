/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */                                             
/*globals BrowserID: true, _:true */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla bid.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

BrowserID.Tooltip = (function() {
  "use strict";

  var ANIMATION_TIME = 250,
      TOOLTIP_DISPLAY = 2000;

  function createTooltip(el) {
      var contents = el.html();
      var template = $("#templateTooltip").html();
      _.templateSettings = {
          interpolate : /\{\{(.+?)\}\}/g
      };
      var tooltip = $(_.template(template, {
        contents: contents
      }));

      return tooltip;
  }

  function positionTooltip(tooltip, target) {
    var targetOffset = target.offset();
    targetOffset.top -= (tooltip.outerHeight() + 5);
    targetOffset.left += 10;

    tooltip.css(targetOffset);
  }

  function animateTooltip(el, complete) {
    el.fadeIn(ANIMATION_TIME, function() {
      setTimeout(function() {
        el.fadeOut(ANIMATION_TIME, complete);
      }, TOOLTIP_DISPLAY);
    });
  }

  function createAndShowRelatedTooltip(el, relatedTo) {
      // This means create a copy of the tooltip element and position it in 
      // relation to an element.  Right now we are putting the tooltip directly 
      // above the element.  Once the tooltip is no longer needed, remove it 
      // from the DOM.
      var tooltip = createTooltip(el).appendTo("body");

      var target = $("#" + relatedTo);
      positionTooltip(tooltip, target);

      animateTooltip(tooltip, function() {
        tooltip.remove();
        tooltip = null;
      });
  }

  function showTooltip(el) {
    el = $(el);
    var messageFor = el.attr("for");

    // First, see if we are "for" another element, if we are, create a copy of 
    // the tooltip to attach to the element.
    if(messageFor) {
      createAndShowRelatedTooltip(el, messageFor);
    }
    else {
      animateTooltip(el);
    }
  }


 return {
    showTooltip: showTooltip
 };

}());
