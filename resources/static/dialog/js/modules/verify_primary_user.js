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
      dom = bid.DOM,
      user = bid.User,
      errors = bid.Errors,
      helpers = bid.Helpers,
      dialogHelpers = helpers.Dialog,
      complete = helpers.complete;

  function verify(callback) {
    /*jshint validthis:true*/
    this.publish("primary_user_authenticating");

    // set up some information about what we're doing
    win.sessionStorage.primaryVerificationFlow = JSON.stringify({
      add: add,
      email: email
    });

    var url = helpers.toURL(auth_url, {email: email});

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

  var Module = bid.Modules.PageModule.extend({
    start: function(data) {
      var self=this;
      data = data || {};

      win = data.window || window;
      add = data.add;
      email = data.email;
      auth_url = data.auth_url;

      user.addressInfo(email, function onSuccess(info) {
        if (showsPrimaryTransition(info.state)) {
          self.renderForm("verify_primary_user", {
            email: data.email,
            auth_url: data.auth_url,
            requiredEmail: data.requiredEmail || false,
            siteName: data.siteName,
            idpName: data.idpName,
            transition_to_primary: info.state === "transition_to_primary"
          });

          if (data.siteTOSPP) {
            dialogHelpers.showRPTosPP.call(self);
          }

          self.click("#cancel", cancel);
          complete(data.ready);
        } else {
          verify.call(self, data.ready);
        }
      }, self.getErrorDialog(errors.addressInfo));


      sc.start.call(self, data);
    },

    submit: verify

    // BEGIN TESTING API
    ,
    cancel: cancel
    // END TESTING API
  });

  sc = Module.sc;

  return Module;
}());

