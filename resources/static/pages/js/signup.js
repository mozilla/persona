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
      validation = bid.Validation,
      errors = bid.Errors,
      tooltip = BrowserID.Tooltip,
      complete = helpers.complete,
      ANIMATION_SPEED = 250,
      storedEmail = pageHelpers,
      winchan = window.WinChan,
      doc = document,
      primaryUserInfo,
      lastEmail,
      sc;

    function showNotice(selector) {
      $(selector).fadeIn(ANIMATION_SPEED);
    }

    function authWithPrimary(oncomplete) {
      pageHelpers.openPrimaryAuth(winchan, primaryUserInfo.email, primaryUserInfo.auth, primaryAuthComplete);

      complete(oncomplete);
    }

    function primaryAuthComplete(error, result, oncomplete) {
      if (error) {
        pageHelpers.showFailure(errors.primaryAuthentication, error, oncomplete);
      }
      else {
        // hey ho, the user is authenticated, re-try the submit.
        createPrimaryUser(primaryUserInfo, oncomplete);
      }
    }

    function createPrimaryUser(info, oncomplete) {
      user.createPrimaryUser(info, function onComplete(status, info) {
        switch(status) {
          case "primary.verified":
            pageHelpers.replaceFormWithNotice("#congrats", complete.curry(oncomplete, true));
            break;
          case "primary.verify":
            primaryUserInfo = info;
            dom.setInner("#primary_email", info.email);
            pageHelpers.replaceInputsWithNotice("#primary_verify", complete.curry(oncomplete, false));
            break;
          case "primary.could_not_add":
            // XXX Can this happen?
            break;
          default:
            break;
        }
      }, pageHelpers.getFailure(errors.createUser, complete));
    }

    function enterPasswordState(info) {
      /*jshint validthis: true*/
      var self=this;
      self.emailToStage = info.email;
      self.submit = passwordSubmit;

      dom.addClass("body", "enter_password");
      dom.focus("#password");
    }

    function passwordSubmit(oncomplete) {
      /*jshint validthis: true*/
      var pass = dom.getInner("#password"),
          vpass = dom.getInner("#vpassword"),
          valid = validation.passwordAndValidationPassword(pass, vpass);

      if(valid) {
        user.createSecondaryUser(this.emailToStage, pass, function(status) {
          if(status.success) {
            pageHelpers.emailSent("waitForUserValidation", oncomplete && oncomplete.curry(true));
          }
          else {
            tooltip.showTooltip("#could_not_add");
            complete(oncomplete, false);
          }
        }, pageHelpers.getFailure(errors.createUser, oncomplete));
      }
      else {
        complete(oncomplete, false);
      }
    }

    function emailSubmit(oncomplete) {
      /*jshint validthis: true*/
      var email = helpers.getAndValidateEmail("#email"),
          self = this;

      if (email) {
        dom.setAttr('#email', 'disabled', 'disabled');
        user.addressInfo(email, function(info) {
          dom.removeAttr('#email', 'disabled');

          var known = info.known;

          if(info.type === "secondary" && known) {
            doc.location = "/signin";
            complete(oncomplete, false);
          }
          else if(info.type === "secondary" && !known) {
            enterPasswordState.call(self, info);
            complete(oncomplete, !known);
          }
          else if(info.type === "primary") {
            createPrimaryUser.call(self, info, oncomplete);
          }
        }, pageHelpers.getFailure(errors.addressInfo, oncomplete));
      }
      else {
        complete(oncomplete, false);
      }
    }

    function back(oncomplete) {
      pageHelpers.cancelEmailSent(oncomplete);
    }

    function onEmailChange(event) {
      /*jshint validthis: true*/

      // this is basically a state reset.
      var email = dom.getInner("#email");
      if(email !== lastEmail) {
        dom.removeClass("body", "enter_password");
        this.submit = emailSubmit;
        lastEmail = email;
      }
    }

    var Module = bid.Modules.PageModule.extend({
      start: function(options) {
        var self=this;
        options = options || {};

        if (options.winchan) winchan = options.winchan;
        if (options.document) doc = options.document;

        dom.focus("form input[autofocus]");

        pageHelpers.setupEmail();

        self.bind("#email", "keyup", onEmailChange);
        self.bind("#email", "change", onEmailChange);
        self.click("#back", back);
        self.click("#authWithPrimary", authWithPrimary);

        // a redirect to the signin page using the link needs to clear
        // the stored email address or else the user may be redirected here.
        self.bind(".redirect", "click", pageHelpers.clearStoredEmail);

        sc.start.call(self, options);

        // If there is an email already set up in pageHelpers.setupEmail,
        // see if the email address is a primary, secondary, known or
        // unknown.  Redirect if needed.
        if (dom.getInner("#email")) {
          self.submit(options.ready);
        }
        else {
          complete(options.ready);
        }
      },

      submit: emailSubmit,
      // BEGIN TESTING API
      emailSubmit: emailSubmit,
      passwordSubmit: passwordSubmit,
      reset: reset,
      back: back,
      authWithPrimary: authWithPrimary,
      primaryAuthComplete: primaryAuthComplete
      // END TESTING API
    });


    // BEGIN TESTING API
    function reset() {
      winchan = window.WinChan;
    }
    // END TESTING API

    sc = Module.sc;

    return Module;
}());
