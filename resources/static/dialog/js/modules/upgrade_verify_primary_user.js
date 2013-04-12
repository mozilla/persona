/*global BrowserID */

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

;(function() {
  "use strict";

  function makeModule(mtype) {
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

    var submit = {

      upgrade: function() {
        /*jshint validthis:true*/
        this.publish("upgraded_primary_user", this.options);
      },

      verify: function(callback) {
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

    };

    function cancel(callback) {
      /*jshint validthis:true*/
      this.close("cancel_state");

      if (mtype === "upgrade" && typeof callback === "function") callback();
      else if (mtype === "verify") complete(callback);
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
        var self = this;
        data = data || {};

        win = data.window || window;
        add = data.add;
        email = data.email;
        auth_url = data.auth_url;

        // major assumption:
        // both siteName and idpName are escaped before they make it here.
        // siteName is escaped in dialog/js/modules/dialog.js
        // idpName is escaped in common/js/user.js->addressInfo

        var view = {
          email: data.email,
          auth_url: data.auth_url,
          requiredEmail: data.requiredEmail || false,
          siteName: data.siteName,
          idpName: data.idpName
        };

        function renderForm(tmpl) {
          self.renderForm(tmpl, view);
          if (data.siteTOSPP) {
            dialogHelpers.showRPTosPP.call(self);
          }
          self.click(CANCEL_SELECTOR, cancel);
        }

        if (mtype === "upgrade") renderForm("upgrade_to_primary_user");
        else if (mtype === "verify") {
          user.addressInfo(email, function onSuccess(info) {
            if (showsPrimaryTransition(info.state)) {
              view.transition_to_primary =
                (info.state === "transition_to_primary");
              renderForm("verify_primary_user");
              complete(data.ready);
            } else {
              submit.verify.call(self, data.ready);
            }
          }, self.getErrorDialog(errors.addressInfo));
        }

        sc.start.call(self, data);
      },

      submit: submit[mtype]

      // BEGIN TESTING API
      ,
      cancel: cancel
      // END TESTING API
    });

    sc = Module.sc;
    return Module;
  }

  BrowserID.Modules.UpgradeToPrimaryUser = makeModule('upgrade');
  BrowserID.Modules.VerifyPrimaryUser = makeModule('verify');

}());