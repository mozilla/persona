/*globals BrowserID: true, $:true, URLParse: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.verifySecondaryAddress = (function() {
  "use strict";

  var ANIMATION_TIME=250,
      bid = BrowserID,
      user = bid.User,
      storage = bid.Storage,
      errors = bid.Errors,
      pageHelpers = bid.PageHelpers,
      dom = bid.DOM,
      helpers = bid.Helpers,
      complete = helpers.complete,
      validation = bid.Validation,
      tooltip = bid.Tooltip,
      token,
      sc,
      mustAuth,
      verifyFunction,
      doc = document,
      REDIRECT_SECONDS = 5,
      secondsRemaining = REDIRECT_SECONDS,
      email,
      redirectTo,
      redirectTimeout,  // set in config if available, use REDIRECT_SECONDS otw.
      uiTimeoutID;

  function showRegistrationInfo(info) {
    dom.setInner("#email", info.email);

    if (info.returnTo) {
      dom.setInner(".website", info.returnTo);
      if (uiTimeoutID) uiTimeoutID = clearTimeout(uiTimeoutID);
      updateRedirectTimeout();
      dom.show(".siteinfo");
    }
  }

  function updateRedirectTimeout() {
    dom.setInner("#redirectTimeout", secondsRemaining);
  }

  function countdownTimeout(onComplete) {
    function checkTime() {
      if (secondsRemaining > 0) {
        updateRedirectTimeout();
        secondsRemaining--;
        uiTimeoutID = setTimeout(checkTime, 1000);
      } else {
        complete(onComplete);
      }
    }

    checkTime();
  }

  function submit(oncomplete) {
    var pass = dom.getInner("#password") || undefined,
        inputValid = !mustAuth || validation.password(pass);

    if (inputValid) {
      user[verifyFunction](token, pass, function(info) {
        dom.addClass("body", "complete");

        var verified = info.valid;

        if (verified) {
          pageHelpers.replaceFormWithNotice("#congrats", function() {
            if (redirectTo) {
              // set the loggedIn status for the site.  This allows us to get
              // a silent assertion without relying on the dialog to set the
              // loggedIn status for the domain.  This is useful when the user
              // closes the dialog OR if redirection happens before the dialog
              // has had a chance to finish its business.
              storage.setLoggedIn(URLParse(redirectTo).originOnly(), email);

              countdownTimeout(function() {
                doc.location.href = redirectTo;
                complete(oncomplete, verified);
              });
            }
            else {
              complete(oncomplete, verified);
            }
          });
        }
        else {
          pageHelpers.showFailure(errors.cannotComplete, info, oncomplete);
        }
      }, function(info) {
        if (info.network && info.network.status === 401) {
          tooltip.showTooltip("#cannot_authenticate");
          complete(oncomplete, false);
        }
        else {
          pageHelpers.showFailure(errors.verifyEmail, info, oncomplete);
        }
      });
    }
    else {
      complete(oncomplete, false);
    }
  }

  function startVerification(oncomplete) {
    /*jshint validthis: true*/
    var self=this;
    user.tokenInfo(token, function(info) {
      if (info) {
        redirectTo = info.returnTo;
        email = info.email;
        showRegistrationInfo(info);
        mustAuth = info.must_auth;
        if (mustAuth) {
          // These are users who are authenticating in a different browser or
          // session than the initiator.
          dom.addClass("body", "enter_password");
          complete(oncomplete, true);
        }
        else {
          // Easy case where user is in same browser and same session, just
          // verify and be done with it all!
          submit(oncomplete);
        }
      }
      else {
        // renderError is used directly instead of pageHelpers.showFailure
        // because showFailure hides the title in the extended info.
        self.renderError("error", errors.cannotConfirm);
        complete(oncomplete, false);
      }
    }, pageHelpers.getFailure(errors.getTokenInfo, oncomplete));
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      var self=this;
      self.checkRequired(options, "token", "verifyFunction");

      token = options.token;
      verifyFunction = options.verifyFunction;
      doc = options.document || document;

      redirectTimeout = options.redirectTimeout;
      if (typeof redirectTimeout === "undefined") {
        redirectTimeout = REDIRECT_SECONDS * 1000;
      }
      secondsRemaining = redirectTimeout / 1000;


      startVerification.call(self, options.ready);

      sc.start.call(self, options);
    },

    submit: submit
  });

  sc = Module.sc;

  return Module;
}());
