// In the style of pages/js/start.js
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

$(function() {
  "use strict";

  window.resizeTo(700, 440); // Gross

  /**
   * For the main page
   */
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
  checkCookiePaths = [ "/add_email_address", "/confirm", "/verify_email_address" ];

  network.init();
  user.init();

  moduleManager.register("cookie_check", modules.CookieCheck);
  moduleManager.start("cookie_check", {
    ready: function(status) {
      if(!status) return;

      moduleManager.register("dialog", modules.Dialog);
      moduleManager.register("add_email", modules.AddEmail);
      moduleManager.register("authenticate", modules.Authenticate);
      moduleManager.register("check_registration", modules.CheckRegistration);
      moduleManager.register("xhr_delay", modules.XHRDelay);
      moduleManager.register("xhr_disable_form", modules.XHRDisableForm);
      moduleManager.register("set_password", modules.SetPassword);
      moduleManager.register("inline_tospp", modules.InlineTosPp);
      moduleManager.register("complete_sign_in", modules.CompleteSignIn);
      moduleManager.register("idp_authentication", modules.IdPAuthentication);

      moduleManager.start("xhr_delay");
      moduleManager.start("xhr_disable_form");
      moduleManager.start("dialog");
      moduleManager.start("inline_tospp");

      moduleManager.start("idp_authentication");
    }
  });
});