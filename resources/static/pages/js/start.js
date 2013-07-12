/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

$(function() {
  "use strict";

  /**
   * For the main page
   */

  var bid = BrowserID,
      helpers = bid.Helpers,
      pageHelpers = bid.PageHelpers,
      user = bid.User,
      dom = bid.DOM,
      network = bid.Network,
      token = pageHelpers.getParameterByName("token"),
      path = document.location.pathname || "/",
      moduleManager = bid.module,
      modules = bid.Modules,
      CookieCheck = modules.CookieCheck,
      XHRDelay = modules.XHRDelay,
      XHRDisableForm = modules.XHRDisableForm,
      Development = modules.Development,
      ANIMATION_TIME = 500,
      checkCookiePaths = [ "/add_email_address", "/confirm", "/verify_email_address" ];


  function shouldCheckCookies(path) {
    if (path) {
      // IE6 and IE7 will blow up if trying to use indexOf on the array.
      for(var i = 0, checkCookiePath; checkCookiePath = checkCookiePaths[i]; ++i) {
        if (checkCookiePath === path) return true;
      }
    }
  }


  // Firefox and IE have rendering bugs where if the box-sizing is set to
  // border-box and a min-height is set, padding is added on top of the
  // min-height, making elements render using the normal W3C box model.  Use
  // a bit of bug detection here in case the bugs are fixed.
  function paddingAddedToMinHeight() {
    var div = document.createElement("div");
    $(div).css({
      "box-sizing": "border-box",
      "min-height": "100px",
      "padding-top": "10px",
      "position": "absolute",
      "top": "-2000px"
    });

    $("body").append(div);

    var divHeight = parseInt($(div).outerHeight(), 10);
    $(div).remove();
    return divHeight === 110;
  }

  function elementHeightWithMargins(element) {
    element = $(element);
    var height = element.outerHeight()
                 + parseInt(element.css("margin-top"), 10)
                 + parseInt(element.css("margin-bottom"), 10);
    return height;
  }


  network.init();
  user.init();

  $(".display_always,.display_auth,.display_nonauth").hide();

  $(window).bind('resize', function() {
    var height = $(window).height()
              // To find the height of the content, subtract the height of the
              // header and footer INCLUDING any top and bottom margins they
              // have.  If the margins are not included, the center content
              // will be too tall and a scroll bar appears.
              - elementHeightWithMargins("header")
              - elementHeightWithMargins("footer");

    $("#vAlign").css({ "height": height });

    // On the manage page, the content element sometimes does not take up the
    // full height of the screen, leaving the footer to float somewhere in the
    // middle.  To compensate, force the min-height of the content so that the
    // footer remains at the bottom of the screen.
    var paddingTop = 0, paddingBottom = 0;

    if (paddingAddedToMinHeight()) {
      paddingTop = parseInt($("#content").css("padding-top") || 0, 10);
      paddingBottom = parseInt($("#content").css("padding-bottom") || 0, 10);
    }

    $("#content").css({ "min-height": height - paddingTop - paddingBottom });
  }).trigger('resize');

  moduleManager.register("xhr_delay", XHRDelay);
  moduleManager.start("xhr_delay");

  moduleManager.register("xhr_disable_form", XHRDisableForm);
  moduleManager.start("xhr_disable_form");

  moduleManager.register("development", Development);
  moduleManager.start("development");

  if (shouldCheckCookies(path)) {
    // do a cookie check on every page except the main page.
    moduleManager.register("cookie_check", CookieCheck);
    moduleManager.start("cookie_check", { ready: start });
  }
  else {
    // the main page makes it through without checking for cookies.
    start(true);
  }

  function verifySecondaryAddress(verifyFunction) {
    var module = bid.verifySecondaryAddress.create();
    module.start({
      token: token,
      verifyFunction: verifyFunction
    });
  }

  function start(status) {
    // If cookies are disabled, do not run any of the page specific code and
    // instead just show the error message.
    if (!status) return;

    user.checkAuthentication(function(authenticated) {
      // If the user is authenticated and the path should not be allowed if the
      // user is authenticated, redirect them back to the main page. See issue
      // #1345 https://github.com/mozilla/browserid/issues/1345
      var module;
      if (path === "/") {
        bid.index();
      }
      else if (path === "/confirm") {
        verifySecondaryAddress("verifyEmail");
      }
      else if (path === "/complete_transition") {
        verifySecondaryAddress("completeTransitionToSecondary");
      }
      else if (path === "/verify_email_address") {
        verifySecondaryAddress("verifyUser");
      }
      else if (path === "/reset_password") {
        module = bid.resetPassword.create();
        module.start({
          token: token
        });
      }
      else if (path === "/about") {
        module = bid.about.create();
        module.start({});
      }
      // TODO /en/tos
      else if (path === "/tos" || path === "/privacy") {
        // do nothing.  This prevents "unknown path" from being displayed to the
        // user.
      }
      else {
        // Instead of throwing a hard error here, adding a message to the console
        // to let developers know something is up.
        helpers.log("unknown path: " + path);
      }

      if (authenticated) {
        displayAuthenticated();
      }
      else {
        displayNonAuthenticated();
      }

      // Now that the user's authentication status is known, the nav can
      // be shown with no visible flicker
      dom.show('.nav');

      // The footer is initially tied to the bottom while the page is loading
      // so that it does not appear to flicker.  Untie the footer and let it
      // rest in its natural position.
      $("footer").css({ position: "", bottom: "" });
    });

    function displayAuthenticated() {
      $(".display_always,.display_auth").fadeIn(ANIMATION_TIME);
      dom.addClass("body", "authenticated");

      if (!path || path === "/") {
        var module = bid.manageAccount.create();
        module.start({});
        $(window).trigger("resize");
      }

      $("a.signOut").click(function(event) {
        event.preventDefault();
        event.stopPropagation();

        user.logoutUser(function() {
          document.location = "/";
        }, pageHelpers.getFailure(bid.Errors.logout));
      });
    }

    function displayNonAuthenticated() {
      $(".display_always").fadeIn(ANIMATION_TIME);
      dom.addClass("body", "not_authenticated");
      $(".display_nonauth").fadeIn(ANIMATION_TIME);
      dom.bindEvent("a.signIn", "click", function(event) {
        event.preventDefault();
        navigator.id.get(function(assertion) {
          document.location.href = "/";
        }, {
          siteName: "Mozilla Persona"
        });
      });
    }
  }

});

