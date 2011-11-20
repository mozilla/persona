/*jshint brgwser:true, jQuery: true, forin: true, laxbreak:true */
/*global _: true, BrowserID: true, PageController: true */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla BrowserID.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
BrowserID.Modules.PickEmail = (function() {
  "use strict";

  var ANIMATION_TIME = 250,
      bid = BrowserID,
      user = bid.User,
      errors = bid.Errors,
      storage = bid.Storage,
      helpers = bid.Helpers,
      dialogHelpers = helpers.Dialog,
      dom = bid.DOM,
      assertion;

  function cancelEvent(event) {
    event && event.preventDefault();
  }

  function pickEmailState(event) {
    cancelEvent(event);

    var self=this;
    if (!dom.getElements("input[type=radio]:checked").length) {
      // If none are already checked, select the first one.
      dom.setAttr('input[type=radio]:eq(0)', 'checked', true);
    }
    // focus whichever is checked.
    dom.focus("input[type=radio]:checked");
    self.submit = signIn;
  }

  function addEmail(event) {
    cancelEvent(event);

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

  function signIn(event) {
    cancelEvent(event);
    var self=this,
        email = dom.getInner("input[type=radio]:checked");

    var valid = checkEmail.call(self, email);
    if (valid) {
      var origin = user.getOrigin();
      storage.site.set(origin, "email", email);

      if (self.allowPersistent) {
        storage.site.set(origin, "remember", $("#remember").is(":checked"));
      }

      dialogHelpers.getAssertion.call(self, email);
    }
  }

  var PickEmail = bid.Modules.PageModule.extend({
    start: function(options) {  
      var origin = user.getOrigin(),
          self=this;

      options = options || {};

      self.allowPersistent = options.allow_persistent;
      self.renderDialog("pickemail", {
        identities: user.getStoredEmailKeypairs(),
        // XXX ideal is to get rid of self and have a User function
        // that takes care of getting email addresses AND the last used email
        // for self site.
        siteemail: storage.site.get(origin, "email"),
        allow_persistent: options.allow_persistent || false,
        remember: storage.site.get(origin, "remember") || false
      });
      dom.getElements("body").css("opacity", "1");

      if (dom.getElements("#selectEmail input[type=radio]:visible").length === 0) {
        // If there is only one email address, the radio button is never shown,
        // instead focus the sign in button so that the user can click enter.
        // issue #412
        dom.focus("#signInButton");
      }

      self.bind("#useNewEmail", "click", addEmail);

      PickEmail.sc.start.call(self, options);

      pickEmailState.call(self);
    },

    signIn: signIn,
    addEmail: addEmail
  });

  return PickEmail;

}());
