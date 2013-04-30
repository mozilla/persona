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
      // processed.
      self.renderLoad("load", {
        title: gettext("signing in")
      });

      dialogHelpers.refreshEmailInfo.call(self, email, function (info) {
        // XXX Why is this here? This is almost a complete duplication of
        // the logic in state.js, and it should be there.
        record = checkEmail.call(self, email);
        // The primary has gone offline, notify the user.
        if ("offline" === info.state) {
          self.close("primary_offline", info);
        }
        else if (record.cert) {
          self.close("email_chosen", info);
        }
        // A secondary address that transitioned from a primary. The
        // user does not have a password - make them set one.
        else if ("transition_no_password" === info.state) {
          self.close("transition_no_password", info);
        }
        // A secondary address on an account with a password
        else if ("secondary" === info.type) {
          self.close("email_chosen", info);
        }
        else {
          self.close("primary_user", info);
        }
      });
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

  function notMe() {
    /*jshint validthis: true*/
    this.publish("notme");
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      var origin = user.getOrigin(),
          self=this;

      options = options || {};

      dom.addClass("body", "pickemail");

      var identities = getSortedIdentities();

      self.renderForm("pick_email", {
        identities: identities,
        siteEmail: user.getOriginEmail()
      });

      if (options.siteTOSPP) {
        dialogHelpers.showRPTosPP.call(self);
      }

      dom.getElements("body").css("opacity", "1");
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
      self.click(NOT_ME_SELECTOR, notMe);

      sc.start.call(self, options);

      pickEmailState.call(self);
    },

    stop: function() {
      sc.stop.call(this);
      dom.removeClass("body", "pickemail");
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
