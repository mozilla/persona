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
      pageHelpers = bid.PageHelpers,
      user = bid.User,
      dom = bid.DOM,
      xhr = bid.XHR,
      network = bid.Network,
      token = pageHelpers.getParameterByName("token"),
      path = document.location.pathname,
      moduleManager = bid.module,
      modules = bid.Modules,
      CodeCheck = modules.CodeCheck,
      XHRDelay = modules.XHRDelay,
      XHRDisableForm = modules.XHRDisableForm;


  xhr.init({ time_until_delay: 10 * 1000 });
  network.init();

  moduleManager.register("code_check", CodeCheck);

  $(".display_always,.display_auth,.display_nonauth").hide();
  if ($('#vAlign').length) {
    $(window).bind('resize', function() { $('#vAlign').css({'height' : $(window).height() }); }).trigger('resize');
  }


  moduleManager.start("code_check", {
    file_name_prefix: "browserid",
    code_ver: "__BROWSERID_CODE_VERSION",
    ready: function(status) {
      if(!status) return;

      dom.addClass("body", "ready");

      moduleManager.register("xhr_delay", XHRDelay);
      moduleManager.register("xhr_disable_form", XHRDisableForm);
      if (!path || path === "/") {
        bid.index();
      }
      else if (path === "/signin") {
        var module = bid.signIn.create();
        module.start({});
      }
      else if (path === "/signup") {
        bid.signUp();
      }
      else if (path === "/forgot") {
        bid.forgot();
      }
      else if (path === "/add_email_address") {
        var module = bid.addEmailAddress.create();
        module.start({
          token: token
        });
      }
      else if(token && path === "/verify_email_address") {
        bid.verifyEmailAddress(token);
      }

      $("a.signOut").click(function(event) {
        event.preventDefault();
        event.stopPropagation();

        user.logoutUser(function() {
          document.location = "/";
        }, pageHelpers.getFailure(bid.Errors.logout));
      });

      var ANIMATION_TIME = 500;
      user.checkAuthentication(function(authenticated) {
        $(".display_always").fadeIn(ANIMATION_TIME);

        dom.addClass("body", authenticated ? "authenticated" : "not_authenticated");
        if (authenticated) {
          $(".display_auth").fadeIn(ANIMATION_TIME);
          if ($('#emailList').length) {
            bid.manageAccount();
          }
        }
        else {
          $(".display_nonauth").fadeIn(ANIMATION_TIME);
        }
      });


    }
  });


});

