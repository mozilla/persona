/*globals BrowserID: true, _: true */
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
      xhr = bid.XHR,
      network = bid.Network,
      token = pageHelpers.getParameterByName("token"),
      path = document.location.pathname,
      moduleManager = bid.module,
      modules = bid.Modules,
      CookieCheck = modules.CookieCheck,
      XHRDelay = modules.XHRDelay,
      XHRDisableForm = modules.XHRDisableForm,
      ANIMATION_TIME = 500;


  xhr.init({ time_until_delay: 10 * 1000 });
  network.init();

  $(".display_always,.display_auth,.display_nonauth").hide();
  if ($('#vAlign').length) {
    $(window).bind('resize', function() { $('#vAlign').css({'height' : $(window).height() }); }).trigger('resize');
  }

  moduleManager.register("xhr_delay", XHRDelay);
  moduleManager.start("xhr_delay");

  moduleManager.register("xhr_disable_form", XHRDisableForm);
  moduleManager.start("xhr_disable_form");

  if(path && path !== "/") {
    // do a cookie check on every page except the main page.
    moduleManager.register("cookie_check", CookieCheck);
    moduleManager.start("cookie_check", { ready: start });
  }
  else {
    // the main page makes it through without checking for cookies.
    start(true);
  }

  function start(status) {
    // If cookies are disabled, do not run any of the page specific code and
    // instead just show the error message.
    if(!status) return;

    dom.addClass("body", "ready");

    if (!path || path === "/") {
      bid.index();
    }
    else if (path === "/signin") {
      var module = bid.signIn.create();
      module.start({});
    }
    else if (path === "/signup") {
      var module = bid.signUp.create();
      module.start({});
    }
    else if (path === "/forgot") {
      bid.forgot();
    }
    else if (path === "/add_email_address") {
      var module = bid.verifySecondaryAddress.create();
      module.start({
        token: token,
        verifyFunction: "verifyEmail"
      });
    }
    else if(token && path === "/verify_email_address") {
      var module = bid.verifySecondaryAddress.create();
      module.start({
        token: token,
        verifyFunction: "verifyUser"
      });
    }
    else {
      // Instead of throwing a hard error here, adding a message to the console
      // to let developers know something is up.
      helpers.log("unknown path");
    }

    user.checkAuthentication(function(authenticated) {
      if (authenticated) {
        displayAuthenticated();
      }
      else {
        displayNonAuthenticated();
      }
    });

    function displayAuthenticated() {
      $(".display_always,.display_auth").fadeIn(ANIMATION_TIME);
      dom.addClass("body", "authenticated");

      if ($('#emailList').length) {
        bid.manageAccount();
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
    }
  }

});

