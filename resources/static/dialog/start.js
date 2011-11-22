(function() {
  var bid = BrowserID,
      moduleManager = bid.module,
      modules = bid.Modules;
  
  moduleManager.register("dialog", modules.Dialog);
  moduleManager.register("add_email", modules.AddEmail);
  moduleManager.register("authenticate", modules.Authenticate);
  moduleManager.register("check_registration", modules.CheckRegistration);
  moduleManager.register("forgot_password", modules.ForgotPassword);
  moduleManager.register("pick_email", modules.PickEmail);
  moduleManager.register("required_email", modules.RequiredEmail);

  moduleManager.start("dialog");

}());

