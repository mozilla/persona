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
      CANCEL_SELECTOR = "#cancel",
      PASSWORD_SELECTOR = "#password",
      VPASSWORD_SELECTOR = "#vpassword",
      sc;

  function submit(callback) {
    /*jshint validthis: true*/
    var pass = dom.getInner(PASSWORD_SELECTOR),
        vpass = dom.getInner(VPASSWORD_SELECTOR),
        options = this.options,
        valid;

    // In FirefoxOS, when the user clicks on the keyboard, it causes the
    // form fields to lose focus, meaning positive checks for focus will not
    // match. If the user is not focused on the vpass field and there is
    // a password but no vpassword, put them in the vpassword field without
    // showing an error. See issue #3502
    // - https://github.com/mozilla/browserid/issues/3502
    if (!dom.is(VPASSWORD_SELECTOR, ":focus") && pass && !vpass) {
      // user is in the password field, hits enter and there is no vpass. User
      // should go to the vpass field without there being an error.
      valid = bid.Validation.newPassword(pass);
      if (valid) {
        dom.focus(VPASSWORD_SELECTOR);
      }
    }
    else {
      valid = bid.Validation.passwordAndValidationPassword(pass, vpass);
      if (valid) {
        this.publish("password_set", { password: pass });
      }
    }

    complete(callback, valid);
  }

  function cancel() {
    /*jshint validthis: true*/
    this.close("cancel_state");
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      var self=this;
      options = options || {};

      self.renderForm("set_password", {
        email: options.email,
        transition_no_password: !!options.transition_no_password,
        domain: helpers.getDomainFromEmail(options.email),
        fxaccount: !!options.fxaccount,
        cancelable: options.cancelable !== false,
        personaTOSPP: options.personaTOSPP
      });

      if (options.siteTOSPP) {
        dialogHelpers.showRPTosPP.call(self);
      }

      self.click(CANCEL_SELECTOR, cancel);

      sc.start.call(self, options);
    },

    submit: submit,
    cancel: cancel
  });

  sc = Module.sc;

  return Module;
}());
