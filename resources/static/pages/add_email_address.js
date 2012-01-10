/*globals BrowserID: true, $:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.addEmailAddress = (function() {
  "use strict";

  var ANIMATION_TIME=250,
      bid = BrowserID,
      user = bid.User,
      storage = bid.Storage,
      errors = bid.Errors,
      pageHelpers = bid.PageHelpers,
      dom = bid.DOM,
      token,
      sc;

  function showError(el, oncomplete) {
    $(".hint,#signUpForm").hide();
    $(el).fadeIn(ANIMATION_TIME, oncomplete);
  }

  function emailRegistrationComplete(oncomplete, info) {
    function complete(status) {
      oncomplete && oncomplete(status);
    }

    var valid = info.valid;
    if (valid) {
      emailRegistrationSuccess(info, complete.curry(true));
    }
    else {
      showError("#cannotconfirm", complete.curry(false));
    }
  }

  function showRegistrationInfo(info) {
    dom.setInner(".email", info.email);

    if (info.origin) {
      dom.setInner(".website", info.origin);
      $(".siteinfo").show();
    }
  }

  function emailRegistrationSuccess(info, oncomplete) {
    dom.addClass("body", "complete");

    showRegistrationInfo(info);

    setTimeout(function() {
      pageHelpers.replaceFormWithNotice("#congrats", oncomplete);
    }, 2000);
  }

  function userMustEnterPassword(info) {
    return !!info.needs_password;
  }

  function verifyWithoutPassword(oncomplete) {
    user.verifyEmailNoPassword(token,
      emailRegistrationComplete.curry(oncomplete),
      pageHelpers.getFailure(errors.verifyEmail, oncomplete)
    );
  }

  function verifyWithPassword(oncomplete) {
    var pass = dom.getInner("#password"),
        vpass = dom.getInner("#vpassword"),
        valid = bid.Validation.passwordAndValidationPassword(pass, vpass);

    if(valid) {
      user.verifyEmailWithPassword(token, pass,
        emailRegistrationComplete.curry(oncomplete),
        pageHelpers.getFailure(errors.verifyEmail, oncomplete)
      );
    }
    else {
      oncomplete && oncomplete(false);
    }
  }

  function startVerification(oncomplete) {
    user.tokenInfo(token, function(info) {
      if(info) {
        showRegistrationInfo(info);

        if(userMustEnterPassword(info)) {
          dom.addClass("body", "enter_password");
          oncomplete(true);
        }
        else {
          verifyWithoutPassword(oncomplete);
        }
      }
      else {
        showError("#cannotconfirm");
        oncomplete(false);
      }
    }, pageHelpers.getFailure(errors.getTokenInfo, oncomplete));
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      function oncomplete(status) {
        options.ready && options.ready(status);
      }

      this.checkRequired(options, "token");

      token = options.token;

      startVerification(oncomplete);

      sc.start.call(this, options);
    },

    submit: verifyWithPassword
  });

  sc = Module.sc;

  return Module;
}());
