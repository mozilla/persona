/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.Modules.VerifyPrimaryUser = (function() {
  "use strict";

  var bid = BrowserID,
      user = bid.User,
      errors = bid.Errors,
      helpers = bid.Helpers,
      dialogHelpers = helpers.Dialog,
      complete = helpers.complete,
      storage = bid.Storage,
      CANCEL_SELECTOR = ".cancel",
      sc;

  function submit(callback) {
    /*jshint validthis:true*/
    var self=this;

    // user.usedAddressAsPrimary will be called when the user returns from
    // the Identity Provider. Trying to call user.usedAddressAsPrimary now,
    // if the user is not authenticated, results in an error.
    self.publish("primary_user_authenticating");

    storage.idpVerification.set({
      add: self.add,
      email: self.email,
      // native is used when the user returns from the primary to prevent
      // WinChan from establishing the postMessage channel.
      'native': self.window.document.location.hash === "#NATIVE"
    });

    var url = helpers.toURL(self.auth_url, { email: self.email });
    self.window.document.location = url;
    complete(callback);
  }

  function cancel(callback) {
    /*jshint validthis:true*/
    this.close("cancel_state");

    complete(callback);
  }

  function showsPrimaryTransition(state) {
    // we know the type is "primary", and the user is not verified with the IdP
    // if they are at this module. Only show the user any text if the user
    // previously used this address when it was vouched for by the fallback
    // IdP.
    return state === "transition_to_primary";
  }


  function renderForm(options) {
    /*jshint validthis: true*/
    options = options || {};
    var self = this;

    // major assumption:
    // both siteName and idpName are escaped before they make it here.
    // siteName is escaped in dialog/js/modules/dialog.js
    // idpName is escaped in common/js/user.js->addressInfo
    self.renderForm("verify_primary_user", {
      email: self.email,
      auth_url: options.auth_url,
      siteName: self.siteName,
      idpName: self.idpName
    });

    if (self.siteTOSPP) {
      dialogHelpers.showRPTosPP.call(self);
    }

    self.click(CANCEL_SELECTOR, cancel);
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      var self = this;
      options = options || {};

      self.importFrom(options,
          "window", "add", "email", "siteName", "idpName");

      if (!self.window) self.window = window;

      sc.start.call(self, options);

      user.addressInfo(self.email, function(info) {
        self.auth_url = info.auth;

        if (showsPrimaryTransition(info.state)) {
          renderForm.call(self, info);
          complete(options.ready);
        }
        else {
          // The user doesn't need to press any buttons, send them to the
          // primary NOW.
          self.submit(options.ready);
        }
      }, self.getErrorDialog(errors.addressInfo));
    },

    submit: submit

    // BEGIN TESTING API
    ,
    cancel: cancel
    // END TESTING API
  });

  sc = Module.sc;
  return Module;

}());
