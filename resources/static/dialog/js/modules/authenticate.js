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
      hints = ["returning", "start", "transitionToSecondary", "addressInfo"],
      DISABLED_ATTRIBUTE = "disabled",
      SUBMIT_DISABLED_CLASS = "submit_disabled",
      CONTENTS_SELECTOR = "#formWrap .contents",
      AUTH_FORM_SELECTOR = "#authentication_form",
      EMAIL_SELECTOR = "#authentication_email",
      PASSWORD_SELECTOR = "#authentication_password",
      FORGOT_PASSWORD_SELECTOR = ".forgotPassword",
      RP_NAME_SELECTOR = "#start_rp_name",
      BODY_SELECTOR = "body",
      AUTHENTICATION_CLASS = "authentication",
      CONTINUE_BUTTON_SELECTOR = ".continue",
      FORM_CLASS = "form",
      CANCEL_PASSWORD_SELECTOR = ".cancelPassword",
      EMAIL_IMMUTABLE_CLASS = "emailImmutable",
      IDP_SELECTOR = "#authentication_form .authentication_idp_name",
      PERSONA_INTRO_SELECTOR = ".persona_intro",
      PERSONA_URL = "https://login.persona.org",
      currentHint;

  function getEmail() {
    // If available, use the email sent back by addressInfo because it contains
    // the normalized email. If not, fetch from the DOM.
    // Email should only be fetched from the DOM if the email is new OR
    // if the user has edited the email field after the email address was
    // checked.
    return (addressInfo && addressInfo.email) ||
               helpers.getAndValidateEmail(EMAIL_SELECTOR);
  }

  function hasPassword(info) {
    /*jshint validthis:true*/
    var self = this;
    /*
     * If this is is a required email, we are making the assumption
     * that it is a secondary address and has a password. The only two ways to
     * get here with emailSpecified are post-reset-password where the email
     * verification occurs in a second browser and when signed in to the
     * assertion level and then choose a secondary backed address.
     */
    return (self.emailSpecified && !self.emailMutable) ||
              (info && info.email && info.type === "secondary" &&
                  (info.state === "known" ||
                   info.state === "transition_to_secondary" ||
                   info.state === "unverified" && self.allowUnverified));
  }

  function isNewPersonaAccount(info) {
    return (info.state === "unknown" && info.type === "secondary"
                && user.isDefaultIssuer());
  }

  function isNewFxAccount(info) {
    return (info.state === "unknown" && !user.isDefaultIssuer());
  }

  function chooseInitialState(info) {
    /*jshint validthis: true*/
    var self=this;
    if (hasPassword.call(self, info)) {
      addressInfo = info;
      enterPasswordState.call(self, info.ready);
    }
    else {
      enterEmailState.call(self, info.ready);
    }
  }

  function checkEmail(info, done) {
    /*jshint validthis: true*/
    var email = getEmail(),
        self = this;
    if (!email) return;

    dom.setAttr(EMAIL_SELECTOR, DISABLED_ATTRIBUTE, DISABLED_ATTRIBUTE);
    dom.addClass(BODY_SELECTOR, SUBMIT_DISABLED_CLASS);
    if (info && info.type) {
      onAddressInfo(info);
    }
    else {
      showHint("addressInfo");
      self.renderLoad("load", {
        title: gettext("Checking with your email provider.")
      });

      user.addressInfo(email, onAddressInfo,
        self.getErrorDialog(errors.addressInfo));
    }

    function onAddressInfo(info) {
      addressInfo = info;
      dom.removeAttr(EMAIL_SELECTOR, DISABLED_ATTRIBUTE);
      dom.removeClass(BODY_SELECTOR, SUBMIT_DISABLED_CLASS);

      self.hideLoad();

      // We rely on user.addressInfo to tell us when an address that would
      // normally be a primary is a secondary because of forcedIssuer. If
      // the user has an address that is normally a primary, but is now using
      // forcedIssuer, info.state will be either transition_to_secondary or
      // transition_no_password depending on whether the user has a password.
      if (hasPassword.call(self, info)) {
        enterPasswordState.call(self);
      }
      else if (isNewPersonaAccount(info)) {
        createPersonaAccount.call(self);
      }
      else if (isNewFxAccount(info)) {
        createFxAccount.call(self);
      }
      else {
        // This is either a transition_no_password or a primary address.
        // The email chosen handler will have the user set a password for
        // transition_no_password. Primary email addresses will be handled
        // accordingly. Either way, a record may not be available because
        // the user may not eyt be authenticated.
        info.allow_new_record = true;
        self.publish("email_chosen", info, info);
      }

      complete(done);
    }
  }

  function createPersonaAccount(callback) {
    /*jshint validthis: true*/
    createAccount.call(this, "new_user", callback);
  }

  function createFxAccount(callback) {
    /*jshint validthis: true*/
    createAccount.call(this, "new_fxaccount", callback);
  }

  function createAccount(msg, callback) {
    /*jshint validthis: true*/
    var self=this,
        email = getEmail();

    if (email) {
      self.close(msg, { email: email }, {
        email: email,
        email_mutable: true
      });
    }

    complete(callback);
  }

  function authenticate(done) {
    /*jshint validthis: true*/
    var email = getEmail(),
        pass = helpers.getAndValidatePassword(PASSWORD_SELECTOR),
        self = this;

    if (email && pass) {
      dialogHelpers.authenticateUser.call(self, email, pass,
          function(authenticated) {
        if (authenticated) {
          self.close("authenticated", {
            email: email,
            password: pass
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
      dom.removeClass("body", className);
    });

    // Fire a window resize event any time a new section is displayed that
    // may change the content's innerHeight.  this will cause the "screen
    // size hacks" to resize the screen appropriately so scroll bars are
    // displayed when needed.
    dom.addClass("body", showSelector);
    dom.fireEvent(window, "resize");
    complete(callback);
  }

  function enterEmailState(done) {
    /*jshint validthis: true*/
    var self=this;
    addressInfo = null;

    // If we are already in the enterEmailState, skip out or else we mess with
    // auto-completion.
    if (self.submit === checkEmail) return complete(done);
    self.submit = checkEmail;

    // If we are signing in to the Persona main site, do not show
    // the Persona intro that says "<site> uses Persona to sign you in!"
    if (user.getOrigin() === PERSONA_URL) {
      dom.hide(PERSONA_INTRO_SELECTOR);
    }

    showHint("start");
    dom.focus(EMAIL_SELECTOR);
    self.publish("enter_email");

    complete(done);
  }

  function enterPasswordState(callback) {
    /*jshint validthis: true*/
    var self=this;

    dom.setInner(PASSWORD_SELECTOR, "");

    self.submit = authenticate;

    var state = "returning";
    if (addressInfo.state === "transition_to_secondary") {
      state = "transitionToSecondary";
      dom.setInner(IDP_SELECTOR, helpers.getDomainFromEmail(addressInfo.email));
    }

    showHint(state, function() {
      dom.focus(PASSWORD_SELECTOR);
      self.publish("enter_password", addressInfo);
      // complete must be called after focus or else the front end unit tests
      // fail. When complete was called outside of showHint, IE8 complained
      // because the element we are trying to focus was no longer available.
      complete(callback);
    });
  }

  function cancelPassword() {
    /*jshint validthis: true*/
    var self = this;
    // If there is an immutable emailSpecified, the user is coming to the
    // authentication screen to authenticate with a specific email address.
    // This is probably a post-verification auth or an assertion->password
    // level authentication. If the user hits cancel, they go back one state
    // in the state machine.
    if (self.emailSpecified && !self.emailMutable) {
      self.publish("cancel_state");
    }
    else {
      enterEmailState.call(this);
    }
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

    /**
     * The continue button is only available on mobile after the user has
     * started to type an email address.
     */
    if (newEmail) {
      dom.removeAttr(CONTINUE_BUTTON_SELECTOR, DISABLED_ATTRIBUTE);
    }
    else {
      dom.setAttr(CONTINUE_BUTTON_SELECTOR, DISABLED_ATTRIBUTE,
        DISABLED_ATTRIBUTE);
    }
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      options = options || {};

      addressInfo = null;

      var self=this;

      self.emailSpecified = options.email || "";
      self.emailMutable = "email_mutable" in options
                              ? options.email_mutable : true;
      self.allowUnverified = options.allowUnverified || false;

      lastEmail = options.email || "";

      dom.removeClass(BODY_SELECTOR, EMAIL_IMMUTABLE_CLASS);
      dom.removeAttr(EMAIL_SELECTOR, "disabled");

      self.submit = null;

      /*
       * If the email is specified and is immutable, it means the user
       * must enter the fallback password for the specified email.
       * The user cannot modify the email address.
       * Possible under the following circumstances:
       * 1. post-reset-password where the email verification occurs in a second
       *        browser.
       * 2. user is signed in to Persona using an address backed by a primary
       *        IdP and they have just chosen an email address backed by the
       *        fallback IdP. (assertion->password level upgrade)
       * 3. email is in transition-to-secondary state and the user just came
       *        from the email picker.
       */
      if (self.emailSpecified && !self.emailMutable) {
        dom.addClass(BODY_SELECTOR, EMAIL_IMMUTABLE_CLASS);
        dom.setAttr(EMAIL_SELECTOR, "disabled", "disabled");
      }


      dom.addClass(BODY_SELECTOR, AUTHENTICATION_CLASS);
      dom.addClass(BODY_SELECTOR, FORM_CLASS);
      dom.setInner(RP_NAME_SELECTOR, options.siteName);
      dom.setInner(EMAIL_SELECTOR, lastEmail);

      currentHint = null;
      dom.setInner(CONTENTS_SELECTOR, "");

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
      self.click(CANCEL_PASSWORD_SELECTOR, cancelPassword);

      Module.sc.start.call(self, options);
      chooseInitialState.call(self, options);
    },

    stop: function() {
      dom.removeClass(BODY_SELECTOR, AUTHENTICATION_CLASS);
      dom.removeClass(BODY_SELECTOR, FORM_CLASS);
      dom.removeClass(BODY_SELECTOR, EMAIL_IMMUTABLE_CLASS);

      _.each(hints, function(className) {
        dom.removeClass("body", className);
      });

      dom.removeAttr(EMAIL_SELECTOR, "disabled");

      Module.sc.stop.call(this);
    }

    // BEGIN TESTING API
    ,
    checkEmail: checkEmail,
    createUser: createPersonaAccount,
    createFxAccount: createFxAccount,
    authenticate: authenticate,
    forgotPassword: forgotPassword,
    emailChange: emailChange
    // END TESTING API
  });

  return Module;

}());
