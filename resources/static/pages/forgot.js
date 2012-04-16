/*globals BrowserID: true, $:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.forgot = (function() {
  "use strict";

  var bid = BrowserID,
      user = bid.User,
      helpers = bid.Helpers,
      pageHelpers = bid.PageHelpers,
      cancelEvent = pageHelpers.cancelEvent,
      dom = bid.DOM,
      tooltip = bid.Tooltip;

  function submit(oncomplete) {
    // GET RID OF THIS HIDE CRAP AND USE CSS!
    $(".notifications .notification").hide();

    var email = helpers.getAndValidateEmail("#email");

    if (email) {
      // XXX TODO - the fake password is to make tests pass.
      user.requestPasswordReset(email, "XXX_FAKE_PASSWORD", function onSuccess(info) {
        if (info.success) {
          pageHelpers.emailSent(oncomplete);
        }
        else {
          var tooltipEl = info.reason === "throttle" ? "#could_not_add" : "#not_registered";
          tooltip.showTooltip(tooltipEl, oncomplete);
        }
      }, pageHelpers.getFailure(bid.Errors.requestPasswordReset, oncomplete));
    } else {
      oncomplete && oncomplete();
    }
  };

  function back(oncomplete) {
    pageHelpers.cancelEmailSent(oncomplete);
  }

  function init() {
    $("form input[autofocus]").focus();

    pageHelpers.setupEmail();

    dom.bindEvent("form", "submit", cancelEvent(submit));
    dom.bindEvent("#back", "click", cancelEvent(back));
  }

  // BEGIN TESTING API
  function reset() {
    dom.unbindEvent("form", "submit");
    dom.unbindEvent("#back", "click");
  }

  init.submit = submit;
  init.reset = reset;
  init.back = back;
  // END TESTING API

  return init;

}());

