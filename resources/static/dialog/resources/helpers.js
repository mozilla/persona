/*jshint browsers:true, forin: true, laxbreak: true */
/*global BrowserID: true*/
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

// The way this works, when the dialog is opened from a web page, it opens
// the window with a #host=<requesting_host_name> parameter in its URL.
// window.setupChannel is called automatically when the dialog is opened. We
// assume that navigator.id.getVerifiedEmail was the function called, we will
// keep this assumption until we start experimenting.  Since IE has some
// serious problems iwth postMessage from a window to a child window, we are now
// communicating not directly with the calling window, but with an iframe
// on the same domain as us that we place into the calling window.  We use a
// function within this iframe to relay messages back to the calling window.
// We do so by searching for the frame within the calling window, and then
// getting a reference to the proxy function.  When getVerifiedEmail is
// complete, it calls the proxy function in the iframe, which then sends a
// message back to the calling window.

(function() {
  "use strict";

  var bid = BrowserID,
      helpers = bid.Helpers,
      user = bid.User,
      tooltip = bid.Tooltip,
      errors = bid.Errors;

  function animateClose(callback) {
    var body = $("body"),
        doAnimation = $("#signIn").length && body.innerWidth() > 640;

    if (doAnimation) {
      $("#signIn").animate({"width" : "685px"}, "slow", function () {
        // post animation
         body.delay(500).animate({ "opacity" : "0.5"}, "fast", function () {
           callback();
         });
      });
    }
    else {
      callback();
    }
  }

  function getAssertion(email, callback) {
    var self=this;
    user.getAssertion(email, function(assert) {
      assert = assert || null;
      animateClose(function() {
        self.close("assertion_generated", {
          assertion: assert
        });

        if (callback) callback(assert);
      });
    }, self.getErrorDialog(errors.getAssertion));
  }

  function authenticateUser(email, pass, callback) {
    var self=this;
    user.authenticate(email, pass,
      function onComplete(authenticated) {
        if (!authenticated) {
          tooltip.showTooltip("#cannot_authenticate");
        }
        if (callback) callback(authenticated);
      }, self.getErrorDialog(errors.authenticate));
  }

  function createUser(email, callback) {
    var self=this;
    user.createUser(email, function(staged) {
      if (staged) {
        self.close("user_staged", {
          email: email
        });
      }
      else {
        tooltip.showTooltip("#could_not_add");
      }
      if (callback) callback(staged);
    }, self.getErrorDialog(errors.createUser));
  }

  function resetPassword(email, callback) {
    var self=this;
    user.requestPasswordReset(email, function(status) {
      if(status.success) {
        self.close("reset_password", {
          email: email
        });
      }
      else {
        tooltip.showTooltip("#could_not_add");
      }
      if (callback) callback(status.success);
    }, self.getErrorDialog(errors.requestPasswordReset));
  }

  function addEmail(email, callback) {
    var self=this;
    user.addEmail(email, function(added) {
      if (added) {
        self.close("email_staged", {
          email: email
        });
      }
      else {
        tooltip.showTooltip("#could_not_add");
      }
      if (callback) callback(added);
    }, self.getErrorDialog(errors.addEmail));
  }

  helpers.Dialog = helpers.Dialog || {};

  helpers.extend(helpers.Dialog, {
    getAssertion: getAssertion,
    authenticateUser: authenticateUser,
    createUser: createUser,
    addEmail: addEmail,
    resetPassword: resetPassword
  });

}());
