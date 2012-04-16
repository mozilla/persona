/*globals BrowserID: true, $:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  "use strict";

  var bid = BrowserID,
      network = bid.Network,
      storage = bid.Storage,
      errors = bid.Errors,
      pageHelpers = bid.PageHelpers,
      token;

  function submit(oncomplete) {
    network.completeUserRegistration(token, function onSuccess(registered) {
      var selector = registered ? "#congrats" : "#cannotcomplete";
      pageHelpers.replaceFormWithNotice(selector, oncomplete);
    }, pageHelpers.getFailure(errors.completeUserRegistration, oncomplete));
  }

  function init(tok, oncomplete) {
    $(".siteinfo").hide();
    $("#congrats").hide();
    token = tok;

    var staged = storage.getStagedOnBehalfOf();
    if (staged) {
      $('.website').html(staged);
      $('.siteinfo').show();
    }

    // go get the email address
    network.emailForVerificationToken(token, function(info) {
      if (info) {
        $('#email').val(info.email);
        submit(oncomplete);
      }
      else {
        pageHelpers.replaceFormWithNotice("#cannotconfirm", oncomplete);
      }
    }, pageHelpers.getFailure(errors.completeUserRegistration, oncomplete));
  }

  // BEGIN TESTING API
  function reset() {
  }

  init.submit = submit;
  init.reset = reset;
  // END TESTING API;

  bid.verifyEmailAddress = init;

}());
