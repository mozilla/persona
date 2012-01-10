/*globals BrowserID: true, $:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  "use strict";

  var bid = BrowserID,
      errors = bid.Errors,
      pageHelpers = bid.PageHelpers,
      token;

  function submit(oncomplete) {
    var pass = $("#password").val(),
        vpass = $("#vpassword").val();

    var valid = bid.Validation.passwordAndValidationPassword(pass, vpass);

    if (valid) {
      bid.Network.completeUserRegistration(token, pass, function onSuccess(registered) {
        var selector = registered ? "#congrats" : "#cannotcomplete";
        pageHelpers.replaceFormWithNotice(selector, oncomplete);
      }, pageHelpers.getFailure(errors.completeUserRegistration, oncomplete));
    }
    else {
      oncomplete && oncomplete();
    }
  }

  function init(tok, oncomplete) {
    $("#signUpForm").bind("submit", pageHelpers.cancelEvent(submit));
    $(".siteinfo").hide();
    $("#congrats").hide();
    token = tok;

    var staged = bid.Storage.getStagedOnBehalfOf();
    if (staged) {
      $('.website').html(staged);
      $('.siteinfo').show();
    }

    // go get the email address
    bid.Network.emailForVerificationToken(token, function(info) {
      if (info) {
        $('#email').val(info.email);
        oncomplete && oncomplete();
      }
      else {
        pageHelpers.replaceFormWithNotice("#cannotconfirm", oncomplete);
      }
    }, pageHelpers.getFailure(errors.completeUserRegistration, oncomplete));
  }

  // BEGIN TESTING API
  function reset() {
    $("#signUpForm").unbind("submit");
  }

  init.submit = submit;
  init.reset = reset;
  // END TESTING API;

  bid.verifyEmailAddress = init;

}());
