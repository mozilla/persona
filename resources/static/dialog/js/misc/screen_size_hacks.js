(function() {
  /**
   * This is a hack to feign fixed headers/footers and dynamic body content
   * size.  On mobile, it helps keep the footer at the very bottom of the
   * screen without the jumpiness that comes with position: fixed in both
   * Fennec and Android native browser.  On desktop/tablet browsers, resizing
   * the #content element causes the contents to be vertically centered.
   */
  function onResize() {
    var selectEmailEl = $("#selectEmail"),
        contentEl = $("#content"),
        signInEl = $("#signIn");

    selectEmailEl.css("position", "static");

    // The mobile breakpoint is 640px in the CSS.  If the max-width is changed
    // there, it must be changed here as well.
    if($(window).width() > 640) {
      // First, remove the mobile hacks
      selectEmailEl.css("width", "");
      contentEl.css("min-height", "");
      signInEl.css("top", "");

      // This is a hack for desktop mode which centers the form vertically in
      // the middle of its container.  We have to do this hack because we use
      // table cell vertical centering when the browserid window is large and
      // the number of emails small, but if the screen size is smaller than the
      // number of emails, we have to print a scrollbar - but only around the
      // emails.

      // set the height to static so that we can get the height without
      // constraints.
      var height = selectEmailEl.innerHeight();
      // re-introduce constraints

      if(height < $("#signIn .vertical").innerHeight()) {
        selectEmailEl.addClass("vcenter");

        /* The below width adjustment is part of a fix for a bug in webkit where
         * there is a ghost padding-right to accommodate the scroll bar that is
         * shown if there are many email addresses. The ghost padding caused the
         * submit button to shift when the user clicked on it, sometimes making
         * the submit button require two clicks.  The other half of the fix is
         * in popup.css, where an adjustment to the padding is made.
         * These two in combination force Chrome to re-flow, which fixes its
         * own bug.
         */
        var width = selectEmailEl.width();
        selectEmailEl.width(width);
      }
      else {
        selectEmailEl.removeClass("vcenter");
      }
    }
    else {
        // First, remove the desktop hacks
        selectEmailEl.removeClass("vcenter");

        // Hack to make sure the email addresses stay within their container.
        // We have to do this ghettoness because table-cells (which are used to
        // vertically center everything) expand to fully contain their children
        // and the ellipsis never show up as expected.

        // First, find the maximum width that emails can be.
        selectEmailEl.css("width", "10px").removeClass("vcenter");
        var constrainedWidth = $("#signIn .contents").innerWidth();

        // Find the real maximum width.
        selectEmailEl.css("width", "");
        var maxEmailWidth = selectEmailEl.innerWidth();

        // If we have a too large an email, constrain the width.
        if(maxEmailWidth > constrainedWidth) {
          selectEmailEl.css("width", constrainedWidth + "px");
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

        favIconHeight = $("#favicon").outerHeight();

        // Force the top of the main content area to be below the favicon area.
        signInEl.css("top", favIconHeight + "px");
    }

    selectEmailEl.css("position", "");
  }

  $(window).resize(onResize);
  onResize();
  BrowserID.resize = onResize;
}());
