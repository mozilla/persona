/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  var bid = BrowserID,
      moduleManager = bid.module,
      modules = bid.Modules,
      network = bid.Network,
      xhr = bid.XHR;


  // A request that takes more than 10 seconds is considered delayed.
  xhr.init({ time_until_delay: 10 * 1000 });
  network.init();

  var hash = window.location.hash || "",
      continuation = hash.indexOf("#CREATE_EMAIL") > -1 || hash.indexOf("#ADD_EMAIL") > -1;

  moduleManager.register("interaction_data", modules.InteractionData);
  moduleManager.start("interaction_data", { continuation: continuation });

  moduleManager.register("development", modules.Development);
  moduleManager.start("development");

  moduleManager.register("cookie_check", modules.CookieCheck);
  moduleManager.start("cookie_check", {
    ready: function(status) {
      if(!status) return;

      moduleManager.register("dialog", modules.Dialog);
      moduleManager.register("add_email", modules.AddEmail);
      moduleManager.register("authenticate", modules.Authenticate);
      moduleManager.register("check_registration", modules.CheckRegistration);
      moduleManager.register("is_this_your_computer", modules.IsThisYourComputer);
      moduleManager.register("pick_email", modules.PickEmail);
      moduleManager.register("required_email", modules.RequiredEmail);
      moduleManager.register("verify_primary_user", modules.VerifyPrimaryUser);
      moduleManager.register("provision_primary_user", modules.ProvisionPrimaryUser);
      moduleManager.register("primary_user_provisioned", modules.PrimaryUserProvisioned);
      moduleManager.register("generate_assertion", modules.GenerateAssertion);
      moduleManager.register("xhr_delay", modules.XHRDelay);
      moduleManager.register("xhr_disable_form", modules.XHRDisableForm);
      moduleManager.register("set_password", modules.SetPassword);

      moduleManager.start("xhr_delay");
      moduleManager.start("xhr_disable_form");
      moduleManager.start("dialog");
    }
  });
}());

