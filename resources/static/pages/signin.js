/*globals BrowserID:true, $:true*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.signIn = (function() {
  "use strict";

  var bid = BrowserID,
      dom = bid.DOM,
      user = bid.User,
      network = bid.Network,
      helpers = bid.Helpers,
      errors = bid.Errors,
      pageHelpers = bid.PageHelpers,
      tooltip = bid.Tooltip,
      doc = document,
      winchan = window.WinChan,
      verifyEmail,
      verifyURL,
      addressInfo,
      sc,
      lastEmail;

  function complete(oncomplete, status) {
    oncomplete && oncomplete(status);
  }

  function provisionPrimaryUser(email, info, callback) {
    // primary user who is authenticated with the primary.
    user.provisionPrimaryUser(email, info, function(status, provInfo) {
      if (status === "primary.verified") {
        network.authenticateWithAssertion(email, provInfo.assertion, function(status) {
          doc.location = "/";

          complete(callback);
        }, pageHelpers.getFailure(errors.authenticateWithAssertion, callback));
      }
      else {
        $("#primary_no_login").fadeIn(250);
        setTimeout(complete.curry(callback), 250);
      }
    }, pageHelpers.getFailure(errors.provisioningPrimary, callback));
  }

  function emailSubmit(oncomplete) {
    var self=this,
        email = helpers.getAndValidateEmail("#email");

    if(email) {
      user.addressInfo(email, function(info) {
        addressInfo = info;

        if(info.type === "secondary") {
          if(info.known) {
            dom.addClass("body", "known_secondary");
            dom.focus("#password");
            self.submit = passwordSubmit;
          }
          else {
            dom.setInner("#unknown_email", email);
            dom.addClass("body", "unknown_secondary");
          }

          complete(oncomplete);
        }
        else if(info.authed) {
          // primary user who is authenticated with the primary, immediately
          // provision and authenticate them to BrowserID.
          provisionPrimaryUser(email, info, oncomplete);
        }
        else {
          dom.addClass("body", "verify_primary");
          dom.setInner("#primary_email", email);
          self.submit = authWithPrimary;

          verifyEmail = email;
          verifyURL = info.auth;

          complete(oncomplete);
        }
      }, pageHelpers.getFailure(errors.addressInfo, oncomplete));
    }
    else {
      complete(oncomplete);
    }
  }

  function passwordSubmit(oncomplete) {
    var email = helpers.getAndValidateEmail("#email"),
        password = helpers.getAndValidatePassword("#password");

    if (email && password) {
      user.authenticate(email, password, function onSuccess(authenticated) {
        if (authenticated) {
          pageHelpers.clearStoredEmail();
          doc.location = "/";
        }
        else {
          // bad authentication
          tooltip.showTooltip("#cannot_authenticate");
        }
        complete(oncomplete);
      }, pageHelpers.getFailure(errors.authenticate, oncomplete));
    }
    else {
      complete(oncomplete);
    }
  }

  function authWithPrimary(oncomplete) {
    pageHelpers.openPrimaryAuth(winchan, verifyEmail, verifyURL, primaryAuthComplete);

    complete(oncomplete);
  }

  function primaryAuthComplete(error, result, oncomplete) {
    if(error) {
      pageHelpers.showFailure(errors.primaryAuthentication, error, oncomplete);
    }
    else {
      provisionPrimaryUser(verifyEmail, addressInfo, oncomplete);
    }
  }

  function onEmailChange(event) {
    // this is basically a state reset.
    var email = dom.getInner("#email");
    if(email !== lastEmail) {
      dom.removeClass("body", "verify_primary");
      dom.removeClass("body", "known_secondary");
      dom.removeClass("body", "unknown_secondary");
      this.submit = emailSubmit;
      lastEmail = email;
    }
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      var self=this;

      if(options && options.document) doc = options.document;
      if(options && options.winchan) winchan = options.winchan;

      pageHelpers.setupEmail();

      self.click("#authWithPrimary", authWithPrimary);
      self.bind("#email", "change", onEmailChange);
      self.bind("#email", "keyup", onEmailChange);

      sc.start.call(self, options);
    },
    submit: emailSubmit

    // BEGIN TESTING API
    ,
    emailSubmit: emailSubmit,
    passwordSubmit: passwordSubmit,
    authWithPrimary: authWithPrimary,
    primaryAuthComplete: primaryAuthComplete
    // END TESTING API
  });


  sc = Module.sc;

  return Module;

}());


