/*globals BrowserID:true, $:true*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.signUp = (function() {
  "use strict";

  var bid = BrowserID,
      user = bid.User,
      dom = bid.DOM,
      helpers = bid.Helpers,
      pageHelpers = bid.PageHelpers,
      cancelEvent = pageHelpers.cancelEvent,
      errors = bid.Errors,
      tooltip = BrowserID.Tooltip,
      ANIMATION_SPEED = 250,
      storedEmail = pageHelpers,
      winchan = window.WinChan,
      verifyEmail,
      verifyURL;

    function showNotice(selector) {
      $(selector).fadeIn(ANIMATION_SPEED);
    }

    function authWithPrimary(oncomplete) {
      pageHelpers.openPrimaryAuth(winchan, verifyEmail, verifyURL, primaryAuthComplete);

      oncomplete && oncomplete();
    }

    function primaryAuthComplete(error, result, oncomplete) {
      if(error) {
        pageHelpers.showFailure(errors.primaryAuthentication, error, oncomplete);
      }
      else {
        // hey ho, the user is authenticated, re-try the submit.
        createUser(verifyEmail, oncomplete);
      }
    }

    function createUser(email, oncomplete) {
      function complete(status) {
        oncomplete && oncomplete(status);
      }

      user.createUser(email, function onComplete(status, info) {
        switch(status) {
          case "secondary.already_added":
            $('#registeredEmail').html(email);
            showNotice(".alreadyRegistered");
            complete(false);
            break;
          case "secondary.verify":
            pageHelpers.emailSent(complete);
            break;
          case "secondary.could_not_add":
            tooltip.showTooltip("#could_not_add");
            complete(false);
            break;
          case "primary.already_added":
            // XXX Is this status possible?
            break;
          case "primary.verified":
            pageHelpers.replaceFormWithNotice("#congrats", complete.bind(null, true));
            break;
          case "primary.verify":
            verifyEmail = email;
            verifyURL = info.auth;
            dom.setInner("#primary_email", email);
            pageHelpers.replaceInputsWithNotice("#primary_verify", complete.bind(null, false));
            break;
          case "primary.could_not_add":
            // XXX Can this happen?
            break;
          default:
            break;
        }
      }, pageHelpers.getFailure(errors.createUser, complete));
    }

    function submit(oncomplete) {
      var email = helpers.getAndValidateEmail("#email");

      function complete(status) {
        oncomplete && oncomplete(status);
      }

      if (email) {
        createUser(email, complete);
      }
      else {
        complete(false);
      }
    }

    function back(oncomplete) {
      pageHelpers.cancelEmailSent(oncomplete);
    }

    function onEmailKeyUp(event) {
      if (event.which !== 13) $(".notification").fadeOut(ANIMATION_SPEED);
    }

    function init(config) {
      config = config || {};

      if(config.winchan) {
        winchan = config.winchan;
      }

      $("form input[autofocus]").focus();

      pageHelpers.setupEmail();

      dom.bindEvent("#email", "keyup", onEmailKeyUp);
      dom.bindEvent("form", "submit", cancelEvent(submit));
      dom.bindEvent("#back", "click", cancelEvent(back));
      dom.bindEvent("#authWithPrimary", "click", cancelEvent(authWithPrimary));
    }

    // BEGIN TESTING API
    function reset() {
      dom.unbindEvent("#email", "keyup");
      dom.unbindEvent("form", "submit");
      dom.unbindEvent("#back", "click");
      dom.unbindEvent("#authWithPrimary", "click");
      winchan = window.WinChan;
      verifyEmail = verifyURL = null;
    }

    init.submit = submit;
    init.reset = reset;
    init.back = back;
    init.authWithPrimary = authWithPrimary;
    init.primaryAuthComplete = primaryAuthComplete;
    // END TESTING API

    return init;
}());
