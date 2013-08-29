/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.PickEmail = (function() {
  "use strict";

  var bid = BrowserID,
      user = bid.User,
      errors = bid.Errors,
      storage = bid.Storage,
      helpers = bid.Helpers,
      dialogHelpers = helpers.Dialog,
      tooltip = bid.Tooltip,
      dom = bid.DOM,
      BODY_SELECTOR = "body",
      PICK_EMAIL_CLASS = "pickemail",
      ADD_EMAIL_SELECTOR = ".useNewEmail",
      NOT_ME_SELECTOR = ".thisIsNotMe",
      sc;

  function pickEmailState(event) {
    /*jshint validthis: true*/
    var self=this,
        // focus the first radio button by default.
        focusSelector = "input[type=radio]:eq(0)";

    // unless a radio button is checked, then focus it.
    if (dom.getElements("input[type=radio]:checked").length) {
      focusSelector = "input[type=radio]:checked";
    }
    dom.focus(focusSelector);

    self.submit = signIn;
  }

  function addEmail() {
    /*jshint validthis: true*/
    this.publish("add_email");
  }

  function checkEmail(email) {
    /*jshint validthis: true*/
    if (!email) {
      tooltip.showTooltip("#must_choose_email");
      return;
    }

    var identity = user.getStoredEmailKeypair(email);

    if (!identity) {
      /*globals alert:true*/
      alert(gettext("The selected email is invalid or has been deleted."));
      this.publish("assertion_generated", {
        assertion: null
      });
    }

    return identity;
  }

  function signIn() {
    /*jshint validthis: true*/
    var self=this,
        email = dom.getInner("input[type=radio]:checked");

    var record = checkEmail.call(self, email);
    if (!! record) {
      // Show the signing in screen as soon as the user presses the button so
      // that it does not seem like there is a huge delay while things being
      // processed. Show the load screen without a title (instead of "signing
      // in") because the user may have to take some action after this - like
      // verify their email address or answer yes/no to "is this your computer"
      self.renderLoad("load", {
        title: ""
      });

      self.close("email_chosen", { email: email });
    }
  }

  function getSortedIdentities() {
    var identities = user.getSortedEmailKeypairs();
    return identities;
  }

  function proxyEventToInput(event) {
    // iOS will not select a radio/checkbox button if the user clicks on the
    // corresponding label.  Because of this, if the user clicks on the label,
    // an even is manually fired on the the radio button.  This only applies
    // if the user clicks on the actual label, not on any input elements
    // contained within the label. This restriction is necessary or else we
    // would be in a never ending loop that would continually toggle the state
    // of any check boxes.
    if(dom.is(event.target, "label")) {
      // Must prevent standard acting browsers from taking care of the click or
      // else it acts like two consecutive clicks.  For radio buttons this will
      // just toggle state.
      event.preventDefault();

      var target = dom.getAttr(event.target, "for");
      dom.fireEvent("#" + target, event.type);
    }
  }

  /**
   * When an email address is selected on mobile layouts, the Persona icon
   * color needs updated to indicate which address is currently selected.
   */
  function onEmailSelect(event) {
    var id = dom.getAttr(event.target, 'id');
    selectEmailByElementId(id);
  }

  function selectEmailByElementId(id) {
    dom.removeClass("label.selected", "selected");
    dom.addClass("label[for=" + id + "]", "selected");
  }

  function notMe() {
    /*jshint validthis: true*/
    this.publish("notme");
  }

  function getPreselectedEmail(options) {
    var emailHint = options.emailHint;
    // Only use the email hint as the preselected email if the user owns the
    // address, otherwise get the last used email for this site.
    if (emailHint && user.getStoredEmailKeypair(emailHint)) {
      return emailHint;
    }

    return user.getOriginEmail();
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      var origin = user.getOrigin(),
          self=this;

      options = options || {};

      dom.addClass(BODY_SELECTOR, PICK_EMAIL_CLASS);

      var identities = getSortedIdentities();

      self.renderForm("pick_email", {
        identities: identities,
        preselectedEmail: getPreselectedEmail(options),
        privacyPolicy: options.privacyPolicy,
        termsOfService: options.termsOfService,
        siteName: options.siteName,
        hostname: options.hostname
      });

      if (options.privacyPolicy && options.termsOfService) {
        dialogHelpers.showRPTosPP.call(self);
      }

      dom.getElements(BODY_SELECTOR).css("opacity", "1");
      if (dom.getElements("#selectEmail input[type=radio]:visible").length === 0) {
        // If there is only one email address, the radio button is never shown,
        // instead focus the sign in button so that the user can click enter.
        // issue #412
        dom.focus("#signInButton");
      }

      self.click(ADD_EMAIL_SELECTOR, addEmail);
      // The click function does not pass the event to the function.  The event
      // is needed for the label handler so that the correct radio button is
      // selected.
      self.bind("#selectEmail label", "click", proxyEventToInput);
      self.bind("#selectEmail input[type=radio]", "click", onEmailSelect);

      self.click(NOT_ME_SELECTOR, notMe);

      sc.start.call(self, options);

      pickEmailState.call(self);
    },

    stop: function() {
      sc.stop.call(this);
      dom.removeClass(BODY_SELECTOR, PICK_EMAIL_CLASS);
    }

    // BEGIN TESTING API
    ,
    signIn: signIn,
    addEmail: addEmail,
    notMe: notMe
    // END TESTING API
  });

  sc = Module.sc;

  return Module;

}());
