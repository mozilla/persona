/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global _: true, BrowserID: true, PageController: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.SetPassword = (function() {
  "use strict";

  var bid = BrowserID,
      user = bid.User,
      errors = bid.Errors,
      helpers = bid.Helpers,
      dom = bid.DOM,
      sc;


  function setPassword(oncomplete) {
    function complete(status) {
      if(oncomplete) oncomplete(status);
    }

    var self = this,
        pass = dom.getInner("#password"),
        vpass = dom.getInner("#vpassword"),
        valid = bid.Validation.passwordAndValidationPassword(pass, vpass);

    if(valid) {
      user.setPassword(
        pass,
        function(status) {
          self.publish("password_set");
          complete(true);
        },
        self.getErrorDialog(errors.setPassword, complete)
      );
    }
    else {
      complete(false);
    }
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      var self=this;
      sc.start.call(self, options);

      self.renderDialog("set_password", options);
    },

    submit: setPassword

    // BEGIN TESTING API
    ,

    setPassword: setPassword
    // END TESTING API
  });

  sc = Module.sc;

  return Module;

}());

