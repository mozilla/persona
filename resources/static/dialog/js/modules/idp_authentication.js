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
      moduleManager.start("set_password", info);
      mediator.subscribe("password_set", passwordSetComplete(self, info.email));
    };
  }

  function passwordSetComplete(self, email) {
    return function(msg, info) {
      dialogHelpers.createUser.call(self, email, info.password, function(info) {
        if (info.success) {
          info.rpInfo = user.rpInfo;
          info.siteName = user.rpInfo.siteName;
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

  function parseRPInfo() {
    var offset = '?'.length;
    var whitelist = [
      'backgroundColor',
      'origin',
      'privacyPolicy',
      'returnTo',
      'siteLogo',
      'siteName',
      'termsOfService'
    ];
    var rawRPInfo = window.location.search.slice(offset);
    if (! rawRPInfo) {
      throw new Error('Missing RPInfo in URL');
    }
    var aRPInfo = {};
    var parts = rawRPInfo.split('&');
    for (var i=0; i < parts.length; i++) {
      var pieces = parts[i].split('=');
      if (whitelist.indexOf(pieces[0]) !== -1) {
	aRPInfo[decodeURIComponent(pieces[0])] = decodeURIComponent(pieces[1]);
      }
    }
    return aRPInfo;
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      options = options || {};
      var self = this;

      ensureSize(700, 440);

      navigator.id.beginAuthentication(function(email) {
        mediator.subscribe("authenticated", function(msg, info) {
          if (email === info.email) {
            navigator.id.completeAuthentication();
          } else {
            // Should never happen
            navigator.id.raiseProvisioningFailure(
              'user is not authenticated as target user');
          }
        });

        mediator.subscribe("new_user", newUserComplete(self));
        var rpInfo = bid.Models.RpInfo.create(parseRPInfo());
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
