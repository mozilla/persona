/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.verifySecondaryAddress = (function() {
  "use strict";

  var ANIMATION_TIME=250,
      bid = BrowserID,
      user = bid.User,
      storage = bid.Storage,
      errors = bid.Errors,
      pageHelpers = bid.PageHelpers,
      dom = bid.DOM,
      helpers = bid.Helpers,
      redirect = helpers.redirect,
      complete = helpers.complete,
      validation = bid.Validation,
      tooltip = bid.Tooltip,
      sc;

  function showRegistrationInfo(info) {
    /*jshint validthis: true*/
    var self=this;
    dom.setInner("#email", info.email);
    dom.setInner(".website", self.redirectTo);

    if (info.returnTo) {
      dom.show(".siteinfo");
    }
  }

  function submit(oncomplete) {
    /*jshint validthis: true*/
    var self = this,
        pass = dom.getInner("#password") || undefined,
        inputValid = !self.mustAuth || validation.password(pass);

    if (inputValid) {
      user[self.verifyFunction](self.token, pass, function(info) {
        dom.addClass("body", "complete");

        var verified = info.valid;
        if (verified) {
          // set the loggedIn status for the site.  This allows us to get
          // a silent assertion without relying on the dialog to set the
          // loggedIn status for the domain.  This is useful when the user
          // closes the dialog OR if redirection happens before the dialog
          // has had a chance to finish its business.
          /*jshint newcap:false*/
          storage.site.set(URLParse(self.redirectTo).originOnly(),
              "logged_in", self.email);

          redirect(self.doc, self.redirectTo);
          complete(oncomplete, verified);
        }
        else {
          pageHelpers.showFailure(errors.cannotComplete, info, oncomplete);
        }
      }, function(info) {
        if (info.network && info.network.status === 401) {
          tooltip.showTooltip("#cannot_authenticate");
          complete(oncomplete, false);
        }
        else {
          pageHelpers.showFailure(errors.verifyEmail, info, oncomplete);
        }
      });
    }
    else {
      complete(oncomplete, false);
    }
  }

  function startVerification(oncomplete) {
    /*jshint validthis: true*/
    var self=this;
    user.tokenInfo(self.token, function(info) {
      if (info) {
        self.redirectTo = info.returnTo || "https://login.persona.org/";
        self.email = info.email;
        showRegistrationInfo.call(self, info);
        self.mustAuth = info.must_auth;

        if (self.mustAuth) {
          // These are users who are authenticating in a different browser or
          // session than the initiator.
          dom.addClass("body", "enter_password");
          dom.focus("input[autofocus]");
          complete(oncomplete, true);
          dom.show("body");
        }
        else {
          // Easy case where user is in same browser and same session, just
          // verify and be done with it all!
          submit.call(self, oncomplete);
        }
      }
      else {
        // renderError is used directly instead of pageHelpers.showFailure
        // because showFailure hides the title in the extended info.
        dom.show("body");
        self.renderError("error", errors.cannotConfirm);
        complete(oncomplete, false);
      }
    }, pageHelpers.getFailure(errors.getTokenInfo, oncomplete));
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      var self=this;
      self.checkRequired(options, "token", "verifyFunction");

      self.token = options.token;
      self.verifyFunction = options.verifyFunction;
      self.doc = options.document || document;

      startVerification.call(self, options.ready);

      sc.start.call(self, options);
    },

    submit: submit
  });

  sc = Module.sc;

  return Module;
}());
