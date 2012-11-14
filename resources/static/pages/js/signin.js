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
      validation = bid.Validation,
      doc = document,
      winchan = window.WinChan,
      complete = helpers.complete,
      verifyEmail,
      verifyURL,
      addressInfo,
      sc;

  function userAuthenticated() {
    pageHelpers.clearStoredEmail();
    doc.location = "/";
  }

  function provisionPrimaryUser(email, info, callback) {
    // primary user who is authenticated with the primary.
    user.provisionPrimaryUser(email, info, function(status, provInfo) {
      if (status === "primary.verified") {
        network.authenticateWithAssertion(email, provInfo.assertion, function(status) {
          userAuthenticated();
          complete(callback);
        }, pageHelpers.getFailure(errors.authenticateWithAssertion, callback));
      }
      else {
        dom.fadeIn("#primary_no_login", 250);
        setTimeout(complete.curry(callback), 250);
      }
    }, pageHelpers.getFailure(errors.provisioningPrimary, callback));
  }

  function emailSubmit(oncomplete) {
    /*jshint validthis: true*/
    var self=this,
        email = helpers.getAndValidateEmail("#email");

    if (email) {
      dom.setAttr('#email', 'disabled', 'disabled');
      user.addressInfo(email, function(info) {
        dom.removeAttr('#email', 'disabled');
        addressInfo = info;

        if (info.type === "secondary") {
          // A secondary user has to either sign in or sign up depending on the
          // status of their email address.
          var bodyClassName = "known_secondary",
              showClassName = "password_entry",
              title = gettext("Sign In"),
              submit = signInSubmit;

          if (info.state === "unknown") {
            bodyClassName = "unknown_secondary";
            showClassName = "vpassword_entry";
            title = gettext("Sign Up"),
            submit = signUpSubmit;
          }

          dom.addClass("body", bodyClassName);
          dom.slideDown("." + showClassName);
          dom.setInner("#title", title);
          self.submit = submit;
          dom.focus("#password");

          complete(oncomplete);
        }
        else if(info.authed) {
          // primary user who is authenticated with the primary, immediately
          // provision and authenticate them to BrowserID.
          provisionPrimaryUser(email, info, oncomplete);
        }
        else {
          // primary user who is not authenticated with primary, must auth with
          // primary and then authenticate them to BrowserID.
          dom.addClass("body", "primary");
          dom.slideDown(".verify_primary");
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

  function signInSubmit(oncomplete) {
    var email = helpers.getAndValidateEmail("#email"),
        password = helpers.getAndValidatePassword("#password");

    if (email && password) {
      user.authenticate(email, password, function(authenticated) {
        if (authenticated) {
          userAuthenticated();
        }
        else {
          tooltip.showTooltip("#cannot_authenticate");
        }
        complete(oncomplete);
      }, pageHelpers.getFailure(errors.authenticate, oncomplete));
    }
    else {
      complete(oncomplete);
    }
  }

  function signUpSubmit(oncomplete) {
    /*jshint validthis: true*/
    var email = dom.getInner("#email"),
        pass = dom.getInner("#password"),
        vpass = dom.getInner("#vpassword"),
        valid = validation.passwordAndValidationPassword(pass, vpass);

    if(email && valid) {
      user.createSecondaryUser(email, pass, function(status) {
        if(status.success) {
          // clearing the stored email from localStorage is taken care
          // of in emailSent.
          pageHelpers.emailSent("waitForUserValidation", email,
            complete.curry(oncomplete, true));
        }
        else {
          tooltip.showTooltip("#could_not_add");
          complete(oncomplete, false);
        }
      }, pageHelpers.getFailure(errors.createUser, oncomplete));
    }
    else {
      complete(oncomplete, false);
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
    /*jshint validthis: true*/
    var self=this;

    // this is basically a state reset.
    var email = dom.getInner("#email");
    if(email !== self.lastEmail) {
      dom.removeClass("body", "primary");
      dom.removeClass("body", "known_secondary");
      dom.removeClass("body", "unknown_secondary");
      dom.slideUp(".password_entry, .vpassword_entry, .verify_primary");
      self.submit = emailSubmit;
      self.lastEmail = email;
    }
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      var self=this;

      if(options && options.document) doc = options.document;
      if(options && options.winchan) winchan = options.winchan;

      pageHelpers.setupEmail();

      // set up the initial lastEmail so that if the user tabs into the email
      // field, the password field does not close. See issue #2353.
      // https://github.com/mozilla/browserid/issues/2353
      self.lastEmail = dom.getInner("#email");

      self.click("#authWithPrimary", authWithPrimary);
      self.bind("#email", "change", onEmailChange);
      self.bind("#email", "keyup", onEmailChange);

      sc.start.call(self, options);

      // If there is an email already set up in pageHelpers.setupEmail, see if
      // the email address is a primary, secondary, known or unknown.  Redirect
      // if needed.
      if (dom.getInner("#email")) {
        self.submit(options.ready);
      }
      else {
        complete(options.ready);
      }
    },
    submit: emailSubmit

    // BEGIN TESTING API
    ,
    emailSubmit: emailSubmit,
    signInSubmit: signInSubmit,
    signUpSubmit: signUpSubmit,
    authWithPrimary: authWithPrimary,
    primaryAuthComplete: primaryAuthComplete
    // END TESTING API
  });


  sc = Module.sc;

  return Module;

}());


