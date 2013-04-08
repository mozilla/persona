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

        // Hack to make sure the email addresses stay within their container.
        // We have to do this ghettoness because table-cells (which are used to
        // vertically center everything) expand to fully contain their children
        // and the ellipsis never show up as expected.

        // First, find the maximum width that emails can be. First set the
        // width of the scrollable element to be very narrow so that we can
        // find the natural innerWidth of the parent.
        scrollableEl.css("width", "10px");
        var parentNaturalWidth = scrollableEl.parent().innerWidth();

        // Unconstrain the scrollableEl's width to find the real maximum
        // width of the emails.
        scrollableEl.css("width", "");
        var maxEmailWidth = scrollableEl.innerWidth();

        // If we have a too large an email, constrain the width.
        if(maxEmailWidth > parentNaturalWidth) {
          scrollableEl.css("width", parentNaturalWidth + "px");
        }

        // Hack to find the min-height of the content area the footer is pushed
        // to the bottom if the contents are too small, and expands off the
        // bottom if the contents are large.

        // Unconstrain everything so that we can find natural heights of all
        // elements.
        $("section,#signIn").css("position", "static");
        contentEl.css("min-height", "0"); // required for Chrome to correctly resize the window

        var headerHeight = $("header").outerHeight();
        var footerHeight = $("footer").outerHeight();
        var windowHeight = $(window).height();

        // Get the amount of space between the header and footer with the
        // caveat that we are forcing the footer to be at the bottom of the
        // screen if the form's unconstrained height is smaller than the
        // content area's height.
        var contentHeight = windowHeight - headerHeight - footerHeight;

        // Get the natural height of the form
        var formHeight = $("#formWrap").outerHeight();

        // set the min height of the content area.  This serves two purposes.
        // First off, for accounts with only one or two emails, it will ensure
        // that the footer is at the bottom of the mobile screen with the
        // emails (or any other form) vertically centered on the screen.
        // Secondly, if an account has many many emails, it will ensure the
        // content area expands correctly to keep any email addresses from
        // being hidden.  This means the footer will be off the screen and the
        // mobile user must scroll the entire content area up and down
        // - contrast this to the desktop version where users with many email
        // addresses only have to scroll the list of emails.
        contentHeight = Math.max(100, contentHeight, formHeight);
        contentEl.css("min-height", contentHeight + "px");

        // Remove the explicit static position we added to let this go back to
        // the position specified in CSS.
        $("section,#signIn").css("position", "");

        var favIconHeight = $("#favicon").outerHeight();

        // Force the top of the main content area to be below the favicon area.
        boundingRectEl.css("top", favIconHeight + "px");
    }

    // this can be used to keep the footer text on one line, #3129.
    function resizeFooterText(cb) {
      function shrinkFooter() {
        var footerText = $('#footerText');
        if (footerText.width() < $('footer').width()) return;
        var newFontSize = parseInt(footerText.css('fontSize'), 10) - 1 + 'px';
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
