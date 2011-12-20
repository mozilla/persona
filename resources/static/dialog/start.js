(function() {
  var bid = BrowserID,
      moduleManager = bid.module,
      modules = bid.Modules;

  moduleManager.register("code_check", modules.CodeCheck);

  moduleManager.start("code_check", {
    code_ver: "ABC123",
    ready: function(status) {
      // if status is false, that means the javascript is out of date and we
      // have to reload.
      if(status) {
        moduleManager.register("dialog", modules.Dialog);
        moduleManager.register("add_email", modules.AddEmail);
        moduleManager.register("authenticate", modules.Authenticate);
        moduleManager.register("check_registration", modules.CheckRegistration);
        moduleManager.register("forgot_password", modules.ForgotPassword);
        moduleManager.register("pick_email", modules.PickEmail);
        moduleManager.register("required_email", modules.RequiredEmail);
        moduleManager.register("verify_primary_user", modules.VerifyPrimaryUser);

        moduleManager.start("dialog");
      }
    }
  });
}());

