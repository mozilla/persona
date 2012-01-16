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
      network = bid.Network,
      user = bid.User,
      token = pageHelpers.getParameterByName("token"),
      path = document.location.pathname,
      XHRDelay = bid.Modules.XHRDelay;

  network.init({ time_until_delay: 10 * 1000 });
  var xhrDelay = XHRDelay.create({});
  xhrDelay.start();

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

  if ($('#vAlign').length) {
    $(window).bind('resize', function() { $('#vAlign').css({'height' : $(window).height() }); }).trigger('resize');
  }

  $("a.signOut").click(function(event) {
    event.preventDefault();
    event.stopPropagation();

    user.logoutUser(function() {
      document.location = "/";
    }, pageHelpers.getFailure(bid.Errors.logout));
  });

  $(".display_always,.display_auth,.display_nonauth").hide();

  var ANIMATION_TIME = 500;
  user.checkAuthentication(function(authenticated) {
    $(".display_always").fadeIn(ANIMATION_TIME);

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


});

