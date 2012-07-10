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
      ANIMATION_SPEED = 250,
      storedEmail = pageHelpers,
      winchan = window.WinChan,
      primaryUserInfo,
      sc;

    function showNotice(selector) {
      $(selector).fadeIn(ANIMATION_SPEED);
    }

    function authWithPrimary(oncomplete) {
      pageHelpers.openPrimaryAuth(winchan, primaryUserInfo.email, primaryUserInfo.auth, primaryAuthComplete);

      oncomplete && oncomplete();
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
      function complete(status) {
        oncomplete && oncomplete(status);
      }

      user.createPrimaryUser(info, function onComplete(status, info) {
        switch(status) {
          case "primary.verified":
            pageHelpers.replaceFormWithNotice("#congrats", complete.bind(null, true));
            break;
          case "primary.verify":
            primaryUserInfo = info;
            dom.setInner("#primary_email", info.email);
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

    function enterPasswordState(info) {
      var self=this;
      self.emailToStage = info.email;
      self.submit = passwordSubmit;

      dom.addClass("body", "enter_password");
    }

    function passwordSubmit(oncomplete) {
      var pass = dom.getInner("#password"),
          vpass = dom.getInner("#vpassword"),
          valid = validation.passwordAndValidationPassword(pass, vpass);

      if(valid) {
        user.createSecondaryUser(this.emailToStage, pass, function(status) {
          if(status.success) {
            pageHelpers.emailSent(oncomplete && oncomplete.curry(true));
          }
          else {
            tooltip.showTooltip("#could_not_add");
            oncomplete && oncomplete(false);
          }
        }, pageHelpers.getFailure(errors.createUser, oncomplete));
      }
      else {
        oncomplete && oncomplete(false);
      }
    }

    function emailSubmit(oncomplete) {
      var email = helpers.getAndValidateEmail("#email"),
          self = this;

      if (email) {
        dom.setAttr('#email', 'disabled', 'disabled');
        user.isEmailRegistered(email, function(isRegistered) {
          if(isRegistered) {
            dom.removeAttr('#email', 'disabled');
            $('#registeredEmail').html(email);
            showNotice(".alreadyRegistered");
            oncomplete && oncomplete(false);
          }
          else {
            user.addressInfo(email, function(info) {
              dom.removeAttr('#email', 'disabled');
              if(info.type === "primary") {
                createPrimaryUser.call(self, info, oncomplete);
              }
              else {
                enterPasswordState.call(self, info);
                oncomplete && oncomplete(!isRegistered);
              }
            }, pageHelpers.getFailure(errors.addressInfo, oncomplete));
          }
        }, pageHelpers.getFailure(errors.isEmailRegistered, oncomplete));
      }
      else {
        oncomplete && oncomplete(false);
      }
    }

    function back(oncomplete) {
      pageHelpers.cancelEmailSent(oncomplete);
    }

    function onEmailKeyUp(event) {
      if (event.which !== 13) $(".notification").fadeOut(ANIMATION_SPEED);
    }

    var Module = bid.Modules.PageModule.extend({
      start: function(options) {
        var self=this;
        options = options || {};

        if (options.winchan) {
          winchan = options.winchan;
        }

        dom.focus("form input[autofocus]");

        pageHelpers.setupEmail();

        self.bind("#email", "keyup", onEmailKeyUp);
        self.click("#back", back);
        self.click("#authWithPrimary", authWithPrimary);

        sc.start.call(self, options);
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
