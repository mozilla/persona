/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.Authenticate = (function() {
  "use strict";

  var ANIMATION_TIME = 250,
      bid = BrowserID,
      user = bid.User,
      errors = bid.Errors,
      validation = bid.Validation,
      tooltip = bid.Tooltip,
      helpers = bid.Helpers,
      dialogHelpers = helpers.Dialog,
      complete = helpers.complete,
      dom = bid.DOM,
      lastEmail = "",
      addressInfo,
      hints = ["returning","start","addressInfo"],
      CONTENTS_SELECTOR = "#formWrap .contents",
      AUTH_FORM_SELECTOR = "#authentication_form",
      EMAIL_SELECTOR = "#authentication_email",
      PASSWORD_SELECTOR = "#authentication_password",
      FORGOT_PASSWORD_SELECTOR = "#forgotPassword",
      RP_NAME_SELECTOR = "#start_rp_name",
      BODY_SELECTOR = "body",
      AUTHENTICATION_CLASS = "authentication",
      FORM_CLASS = "form",
      AUTHENTICATION_LABEL = "#authentication_form label[for=authentication_email]",
      EMAIL_LABEL = "#authentication_form .label.email_state",
      TRANSITION_TO_SECONDARY_LABEL = "#authentication_form .label.transition_to_secondary",
      PASSWORD_LABEL = "#authentication_form .label.password_state",
      IDP_SELECTOR = "#authentication_form .authentication_idp_name",
      currentHint;

  function getEmail() {
    return helpers.getAndValidateEmail(EMAIL_SELECTOR);
  }

  function hasPassword(info) {
    return (info && info.email && info.type === "secondary" &&
      (info.state === "known" || info.state === "transition_to_secondary" ));
  }

  function initialState(info) {
    /*jshint validthis: true*/
    var self=this;

    self.submit = checkEmail;
    if (hasPassword(info)) {
      addressInfo = info;
      enterPasswordState.call(self, info.ready);
    }
    else {
      showHint("start");
      enterEmailState.call(self);
      complete(info.ready);
    }
  }

  function checkEmail(info) {
    /*jshint validthis: true*/
    var email = getEmail(),
        self = this;

    if (!email) return;

    dom.setAttr(EMAIL_SELECTOR, 'disabled', 'disabled');
    if (info && info.type) {
      onAddressInfo(info);
    }
    else {
      showHint("addressInfo");
      user.addressInfo(email, onAddressInfo,
        self.getErrorDialog(errors.addressInfo));
    }

    function onAddressInfo(info) {
      addressInfo = info;
      dom.removeAttr(EMAIL_SELECTOR, 'disabled');

      if ("offline" === info.state) {
        self.close("primary_offline", info, info);
      }
      else if ("primary" === info.type) {
        self.close("primary_user", info, info);
      }
      else if (hasPassword(info)) {
        enterPasswordState.call(self);
      } else if ("transition_no_password" === info.state) {
        transitionNoPassword.call(self, info);
      } else {
        createSecondaryUser.call(self);
      }
    }
  }

  function createSecondaryUser(callback) {
    /*jshint validthis: true*/
    var self=this,
        email = getEmail();

    if (email) {
      self.close("new_user", { email: email }, { email: email });
    } else {
      complete(callback);
    }
  }

  function transitionNoPassword(info) {
    /*jshint validthis: true*/
    var self = this;
    var email = getEmail();

    if (email) {
      var data = { email: email, transition_no_password: true };
      self.close("transition_no_password", data, data);
    }
  }

  function authenticate(done) {
    /*jshint validthis: true*/
    var email = getEmail(),
        pass = helpers.getAndValidatePassword(PASSWORD_SELECTOR),
        self = this;

    if (email && pass) {
      dialogHelpers.authenticateUser.call(self, email, pass, function(authenticated) {
        if (authenticated) {
          self.close("authenticated", {
            email: email
          });
        }
        complete(done);
      });
    }
    else {
      complete(done);
    }
  }

  function showHint(showSelector, callback) {
    // Only show the hint if it is not already shown. Showing the same hint
    // on every keypress massively slows down Fennec. See issue #2010
    // https://github.com/mozilla/browserid/issues/2010
    if (currentHint === showSelector) return;
    currentHint = showSelector;

    _.each(hints, function(className) {
      if (className !== showSelector) {
        dom.hide("." + className + ":not(." + showSelector + ")");
      }
    });

    $("." + showSelector).fadeIn(ANIMATION_TIME, function() {
      // Fire a window resize event any time a new section is displayed that
      // may change the content's innerHeight.  this will cause the "screen
      // size hacks" to resize the screen appropriately so scroll bars are
      // displayed when needed.
      dom.fireEvent(window, "resize");
      complete(callback);
    });
  }

  function enterEmailState() {
    /*jshint validthis: true*/
    var self=this;
    if (!dom.is(EMAIL_SELECTOR, ":disabled")) {
      self.publish("enter_email");
      dom.setInner(AUTHENTICATION_LABEL, dom.getInner(EMAIL_LABEL));
      self.submit = checkEmail;
      showHint("start");
      dom.focus(EMAIL_SELECTOR);
    }
  }

  function enterPasswordState(callback) {
    /*jshint validthis: true*/
    var self=this;

    dom.setInner(PASSWORD_SELECTOR, "");

    self.submit = authenticate;
    var labelSelector = (addressInfo.state === "known") ? PASSWORD_LABEL : TRANSITION_TO_SECONDARY_LABEL;
    if (labelSelector === TRANSITION_TO_SECONDARY_LABEL) {
      dom.setInner(IDP_SELECTOR, helpers.getDomainFromEmail(addressInfo.email));
    }
    dom.setInner(AUTHENTICATION_LABEL, dom.getInner(labelSelector));

    showHint("returning", function() {
      dom.focus(PASSWORD_SELECTOR);
      self.publish("enter_password", addressInfo);
      // complete must be called after focus or else the front end unit tests
      // fail. When complete was called outside of showHint, IE8 complained
      // because the element we are trying to focus was no longer available.
      complete(callback);
    });
  }

  function forgotPassword() {
    /*jshint validthis: true*/
    var email = getEmail();
    if (email) {
      var info = addressInfo || { email: email };
      this.publish("forgot_password", info, info );
    }
  }

  function emailChange() {
    /*jshint validthis: true*/
    var newEmail = dom.getInner(EMAIL_SELECTOR);
    if (newEmail !== lastEmail) {
      lastEmail = newEmail;
      enterEmailState.call(this);
    }
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      options = options || {};

      addressInfo = null;
      lastEmail = options.email || "";

      var self=this;

      dom.addClass(BODY_SELECTOR, AUTHENTICATION_CLASS);
      dom.addClass(BODY_SELECTOR, FORM_CLASS);
      dom.setInner(RP_NAME_SELECTOR, options.siteName);
      dom.setInner(EMAIL_SELECTOR, lastEmail);

      currentHint = null;
      dom.setInner(CONTENTS_SELECTOR, "");
      dom.hide(".returning,.start");

      // Since the authentication form is ALWAYS in the DOM, there is no
      // renderForm call which will hide the error, wait or delay screens.
      // Because one of those may be shown, just show the normal form. See
      // issue #2839
      self.hideWarningScreens();

      // We have to show the TOS/PP agreements to *all* users here. Users who
      // are already authenticated to their IdP but do not have a Persona
      // account automatically have an account created with no further
      // interaction.  To make sure they see the TOS/PP agreement, show it
      // here.
      if (options.siteTOSPP) {
        dialogHelpers.showRPTosPP.call(self);
      }

      self.bind(EMAIL_SELECTOR, "keyup", emailChange);
      // Adding the change event causes the email to be checked whenever an
      // element blurs but it has been updated via autofill.  See issue #406
      self.bind(EMAIL_SELECTOR, "change", emailChange);
      self.click(FORGOT_PASSWORD_SELECTOR, forgotPassword);

      Module.sc.start.call(self, options);
      initialState.call(self, options);
    },

    stop: function() {
      dom.removeClass(BODY_SELECTOR, AUTHENTICATION_CLASS);
      dom.removeClass(BODY_SELECTOR, FORM_CLASS);
      Module.sc.stop.call(this);
    }

    // BEGIN TESTING API
    ,
    checkEmail: checkEmail,
    createUser: createSecondaryUser,
    authenticate: authenticate,
    forgotPassword: forgotPassword
    // END TESTING API
  });

  return Module;

}());
