/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global _: true, BrowserID: true, PageController: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.SetPassword = (function() {
  "use strict";
  var bid = BrowserID,
      dom = bid.DOM,
      helpers = bid.Helpers,
      complete = helpers.complete,
      dialogHelpers = helpers.Dialog,
      sc;

  function submit(callback) {
    var pass = dom.getInner("#password"),
        vpass = dom.getInner("#vpassword"),
        options = this.options;

    var valid = bid.Validation.passwordAndValidationPassword(pass, vpass);
    if(valid) {
      this.publish("password_set", { password: pass });
    }

    complete(callback, valid);
  }

  function cancel() {
    this.close("cancel_state");
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      var self=this;
      options = options || {};

      self.renderDialog("set_password", {
        password_reset: !!options.password_reset,
        cancelable: options.cancelable !== false
      });

      self.click("#cancel", cancel);

      sc.start.call(self, options);
    },

    submit: submit,
    cancel: cancel
  });

  sc = Module.sc;

  return Module;
}());
