/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  "use strict";

  /**
   * This is a hack to feign fixed headers/footers and dynamic body content
   * size.  On mobile, it helps keep the footer at the very bottom of the
   * screen without the jumpiness that comes with position: fixed in both
   * Fennec and Android native browser.  On desktop/tablet browsers, resizing
   * the #content element causes the contents to be vertically centered.
   */

  function onResize() {
    var scrollableEl = $(".form_section"),
        contentEl = $("#content"),
        boundingRectEl = $("#signIn");

    scrollableEl.css("position", "static");

    function desktopHacks() {
      // First, remove the mobile hacks
      scrollableEl.css("width", "");
      contentEl.css("min-height", "");
      boundingRectEl.css("top", "");

      // This is a hack for desktop mode which centers the form vertically in
      // the middle of its container.  We have to do this hack because we use
      // table cell vertical centering when the browserid window is large and
      // the number of emails small, but if the screen size is smaller than the
      // number of emails, we have to print a scrollbar - but only around the
      // emails.

      if(scrollableEl.innerHeight() < boundingRectEl.innerHeight()) {
        scrollableEl.addClass("vcenter");

        /* The below width adjustment is part of a fix for a bug in webkit where
         * there is a ghost padding-right to accommodate the scroll bar that is
         * shown if there are many email addresses. The ghost padding caused the
         * submit button to shift when the user clicked on it, sometimes making
         * the submit button require two clicks.  The other half of the fix is
         * in popup.css, where an adjustment to the padding is made.
         * These two in combination force Chrome to re-flow, which fixes its
         * own bug.
         */
        var width = scrollableEl.width();
        scrollableEl.width(width);
      }
      else {
        scrollableEl.removeClass("vcenter");
      }
    }

    function mobileHacks() {
        // First, remove the desktop hacks
        scrollableEl.removeClass("vcenter");
        boundingRectEl.css("top", "");
        scrollableEl.css("width", "");

        // Hack to find the min-height of the content area the footer is pushed
        // to the bottom if the contents are too small, and expands off the
        // bottom if the contents are large.

        // Get the natural height of the form
        var formHeight = $("#formWrap").outerHeight();

        var totalInnerHeight = formHeight + $(".buttonrow").outerHeight();
        var bodyHeight = $("body").innerHeight();
        if (totalInnerHeight < bodyHeight) {
          $("body").addClass("scrollButtonRow");
        }
        else {
          $("body").removeClass("scrollButtonRow");
        }
    }

    // this can be used to keep the footer text on one line, #3129.
    // but let's set a sensible lower limit, #3426.
    function resizeFooterText(cb) {
      function shrinkFooter() {
        var footerText = $('#footerText');
        var footerFontSize = parseInt(footerText.css('fontSize'), 10);
        if (footerFontSize < 10 || footerText.width() < $('footer').width()) return;
        var newFontSize = footerFontSize - 1 + 'px';
        footerText.css('fontSize', newFontSize);
        setTimeout(shrinkFooter); // let UI loop run before measuring again
      }
      shrinkFooter();
    }

    // The mobile breakpoint is 640px in the CSS.  If the max-width is changed
    // there, it must be changed here as well.
    if($(window).width() > 640) {
      desktopHacks();
    }
    else {
      mobileHacks();
    }
    resizeFooterText();
    scrollableEl.css("position", "");
  }

  $(window).resize(onResize);
  onResize();
  BrowserID.resize = onResize;
}());
