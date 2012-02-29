/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global _: true, BrowserID: true, PageController: true */
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
      dom = bid.DOM,
      sc;

  function pickEmailState(event) {
    var self=this;
    if (!dom.getElements("input[type=radio]:checked").length) {
      // If none are already checked, select the first one.
      dom.setAttr('input[type=radio]:eq(0)', 'checked', true);
    }
    // focus whichever is checked.
    dom.focus("input[type=radio]:checked");
    self.submit = signIn;
  }

  function addEmail() {
    this.close("add_email");
  }

  function checkEmail(email) {
    var identity = user.getStoredEmailKeypair(email);
    if (!identity) {
      alert("The selected email is invalid or has been deleted.");
      this.close("assertion_generated", {
        assertion: null
      });
    }

    return !!identity;
  }

  function signIn() {
    var self=this,
        email = dom.getInner("input[type=radio]:checked");

    var valid = checkEmail.call(self, email);
    if (valid) {
      var origin = user.getOrigin();
      storage.site.set(origin, "email", email);

      if (self.allowPersistent) {
        storage.site.set(origin, "remember", $("#remember").is(":checked"));
      }

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

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      var origin = user.getOrigin(),
          self=this;

      options = options || {};

      self.allowPersistent = options.allow_persistent;
      dom.addClass("body", "pickemail");

      self.renderDialog("pick_email", {
        identities: getSortedIdentities(),
        siteemail: storage.site.get(origin, "email"),
        allow_persistent: options.allow_persistent || false,
        remember: storage.site.get(origin, "remember") || false,
        privacy_url: options.privacyURL,
        tos_url: options.tosURL
      });
      dom.getElements("body").css("opacity", "1");
      $('p.tospp').css('width', (240 - $('#signIn button:visible').outerWidth()) + 'px');
      if (dom.getElements("#selectEmail input[type=radio]:visible").length === 0) {
        // If there is only one email address, the radio button is never shown,
        // instead focus the sign in button so that the user can click enter.
        // issue #412
        dom.focus("#signInButton");
      }

      self.click("#useNewEmail", addEmail);
      // The click function does not pass the event to the function.  The event
      // is needed for the label handler so that the correct radio button is
      // selected.
      self.bind("#selectEmail label", "click", proxyEventToInput);

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
    addEmail: addEmail
    // END TESTING API
  });

  sc = Module.sc;

  return Module;

}());
