/*globals BrowserID: true, $:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.verifySecondaryAddress = (function() {
  "use strict";

  var ANIMATION_TIME=250,
      bid = BrowserID,
      user = bid.User,
      errors = bid.Errors,
      pageHelpers = bid.PageHelpers,
      dom = bid.DOM,
      helpers = bid.Helpers,
      complete = helpers.complete,
      validation = bid.Validation,
      token,
      sc,
      mustAuth,
      verifyFunction;

  function showError(el, oncomplete) {
    dom.hide(".hint,#signUpForm");
    $(el).fadeIn(ANIMATION_TIME, oncomplete);
  }

  function showRegistrationInfo(info) {
    dom.setInner("#email", info.email);

    if (info.origin) {
      dom.setInner(".website", info.origin);
      dom.show(".siteinfo");
    }
  }

  function submit(oncomplete) {
    var pass = dom.getInner("#password") || undefined,
        valid = !mustAuth || validation.password(pass);

    if (valid) {
      user[verifyFunction](token, pass, function(info) {
        dom.addClass("body", "complete");

        var selector = info.valid ? "#congrats" : "#cannotcomplete";
        pageHelpers.replaceFormWithNotice(selector, complete.curry(oncomplete, info.valid));
      }, pageHelpers.getFailure(errors.verifyEmail, oncomplete));
    }
    else {
      complete(oncomplete, false);
    }
  }

  function startVerification(oncomplete) {
    user.tokenInfo(token, function(info) {
      if(info) {
        showRegistrationInfo(info);

        mustAuth = info.must_auth;

        if (mustAuth) {
          dom.addClass("body", "enter_password");
          complete(oncomplete, true);
        }
        else {
          submit(oncomplete);
        }
      }
      else {
        showError("#cannotconfirm");
        complete(oncomplete, false);
      }
    }, pageHelpers.getFailure(errors.getTokenInfo, oncomplete));
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      this.checkRequired(options, "token", "verifyFunction");

      token = options.token;
      verifyFunction = options.verifyFunction;

      startVerification(options.ready);

      sc.start.call(this, options);
    },

    submit: submit
  });

  sc = Module.sc;

  return Module;
}());
