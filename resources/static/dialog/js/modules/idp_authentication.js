/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.IdPAuthentication= (function() {
  "use strict";

  var bid = BrowserID,
  helpers = bid.Helpers,
  user = bid.User,
  dom = bid.DOM,
  network = bid.Network,
  path = document.location.pathname || "/",
  mediator = bid.Mediator,
  dialogHelpers = bid.Helpers.Dialog,
  moduleManager = bid.module,
  modules = bid.Modules,
  CookieCheck = modules.CookieCheck,
  XHRDelay = modules.XHRDelay,
  XHRDisableForm = modules.XHRDisableForm,
  Development = modules.Development,
  ANIMATION_TIME = 500,
  EMAIL_PRESENT_NEXT = 'button:visible',
  sc;

  function ensureSize(width, height) {
    window.resizeBy(width - window.innerWidth,
                    height - window.innerHeight);
  }

  function newUserComplete(self) {
    return function(msg, info) {
      // TODO: Are we sure that we authed as email?
      moduleManager.start("set_password", info);
      mediator.subscribe("password_set", passwordSetComplete(self, info.email));
    };
  }

  function passwordSetComplete(self, email) {
    return function(msg, info) {
      // TODO merge broke us - user.setRPInfo must now be called like in
      // resources/static/dialog/js/modules/dialog.js line 130, 286
      //      params.origin = user.getOrigin();
      dialogHelpers.createUser.call(self, email, info.password, function(info) {
        if (info.success) {
          // TODO Desktop code isn't passing through this information
          info.rpInfo = user.rpInfo;
          info.siteName = 'TODO';
          info.email = email;
          info.verifier = "waitForUserValidation";
          info.verificationMessage = "user_confirmed";

          var checkRegistration = moduleManager.start("check_registration", info);
          mediator.subscribe('user_confirmed', function(msg, confirmationInfo) {
            if (confirmationInfo.mustAuth) {
              var errFn = renderWaitForUserValidationError(self);
              errFn("Expected 'false', but got '" + confirmationInfo.mustAuth + "'");
            } else {
              navigator.id.completeAuthentication();
            }
          });
          checkRegistration.startCheck();
        }
      });
    };
  }

  function renderWaitForUserValidationError(self) {
    return function(err) {
      self.renderError("error", {
        action: {
          title: "error in waitForUserValidation",
          message: err
        }
      });
    };
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      options = options || {};
      var self = this;

      ensureSize(700, 440);

      navigator.id.beginAuthentication(function(email) {
        mediator.subscribe("authentication_success", function(msg, info) {
          // TODO: Are we sure that we authed as email?
          navigator.id.completeAuthentication();
        });

        mediator.subscribe("new_user", newUserComplete(self));

        var rpInfo = bid.Models.RpInfo.create({
          origin: "http://127.0.0.1:10001",
          siteName: "We are awesome"
        });
        user.setRpInfo(rpInfo);

        moduleManager.start("authenticate", {
          rpInfo: rpInfo,
          email: email
        });
        // TODO: Use emailhint instead of this hack
        $(EMAIL_PRESENT_NEXT).click();
      });
    },
    stop: function() {
      sc.stop.call(this);
    }
  });

  sc = Module.sc;

  return Module;
}());
