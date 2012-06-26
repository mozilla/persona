/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global _: true, BrowserID: true, PageController: true */
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
      helpers = bid.Helpers,
      complete = helpers.complete;

  function verify(callback) {
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
    this.close("cancel_state");
    callback && callback();
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(data) {
      var self=this;
      data = data || {};

      win = data.window || window;
      add = data.add;
      email = data.email;
      auth_url = data.auth_url;

      var templateData = helpers.extend({}, data, {
        requiredEmail: data.requiredEmail || false,
        privacy_url: data.privacyURL || null,
        tos_url: data.tosURL || null
      });
      self.renderDialog("verify_primary_user", templateData);

      self.click("#cancel", cancel);

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

