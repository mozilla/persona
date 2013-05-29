/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.Modules.VerifyPrimaryUser = (function() {
  "use strict";

  var bid = BrowserID,
      sc,
      win,
      add,
      email,
      auth_url,
      user = bid.User,
      errors = bid.Errors,
      helpers = bid.Helpers,
      dialogHelpers = helpers.Dialog,
      complete = helpers.complete,
      CANCEL_SELECTOR = ".cancel";

  function submit(callback) {
    /*jshint validthis:true*/
    var self=this;

    // user.usedAddressAsPrimary will be called when the user returns from
    // the Identity Provider. Trying to call user.usedAddressAsPrimary now,
    // if the user is not authenticated, results in an error.
    self.publish("primary_user_authenticating");

    // set up some information about what we're doing
    win.sessionStorage.primaryVerificationFlow = JSON.stringify({
      add: add,
      email: email
    });

    var url = helpers.toURL(auth_url, { email: email });
    win.document.location = url;
    complete(callback);
  }

  function cancel(callback) {
    /*jshint validthis:true*/
    this.close("cancel_state");

    complete(callback);
  }

  function showsPrimaryTransition(state) {
    // we know the type is "primary", and they aren't verified to be at
    // this module. We need to show the transition is we've never seen
    // this email before, or we have, but last time it was a secondary.
    // The state should be marked "known" when the verification returns.
    return state === "unknown" || state === "transition_to_primary";
  }


  function renderForm() {
    /*jshint validthis: true*/
    var self = this,
        options = self.options,
        // major assumption:
        // both siteName and idpName are escaped before they make it here.
        // siteName is escaped in dialog/js/modules/dialog.js
        // idpName is escaped in common/js/user.js->addressInfo
        view = {
          email: options.email,
          auth_url: auth_url,
          requiredEmail: options.requiredEmail || false,
          siteName: options.siteName,
          idpName: options.idpName,
          transition_to_primary: options.transition_to_primary
        };

    self.renderForm("verify_primary_user", view);

    if (options.siteTOSPP) {
      dialogHelpers.showRPTosPP.call(self);
    }

    self.click(CANCEL_SELECTOR, cancel);
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      var self = this;
      options = options || {};

      win = options.window || window;
      add = options.add;
      email = options.email;

      sc.start.call(self, options);

      user.addressInfo(email, function(info) {
        auth_url = info.auth;

        if ("transition_to_primary" === info.state) {
          options.transition_to_primary = true;
        }

        if (showsPrimaryTransition(info.state)) {
          renderForm.call(self);
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
