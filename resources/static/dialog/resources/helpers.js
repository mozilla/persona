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
      $("#signIn").animate({"width" : "95%"}, 750, function () {
         body.delay(500).animate({ "opacity" : "0.5"}, 500);
      });

      // Call setTimeout here because on Android default browser, sometimes the
      // callback is not correctly called, it seems as if jQuery does not know
      // the animation is complete.
      setTimeout(callback, 1750);
    }
    else {
      callback();
    }
  }

  function getAssertion(email, callback) {
    var self=this;
    var wait = bid.Screens.wait;
    wait.show("wait", bid.Wait.generateKey);
    user.getAssertion(email, function(assert) {
      assert = assert || null;
      wait.hide();
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
    function complete(status) {
      callback && callback(status);
    }

    var self=this;
    user.createUser(email, function(status, info) {
      switch(status) {
        case "secondary.already_added":
          // XXX how to handle this - createUser should not be called on
          // already existing addresses, so this path should not be called.
          tooltip.showTooltip("#already_registered");
          complete(false);
          break;
        case "secondary.verify":
          self.close("user_staged", {
            email: email
          });
          complete(true);
          break;
        case "secondary.could_not_add":
          tooltip.showTooltip("#could_not_add");
          complete(false);
          break;
        case "primary.already_added":
          // XXX Is this status possible?
          break;
        case "primary.verified":
          self.close("primary_user_verified", {
            email: email
          });
          complete(true);
          break;
        case "primary.verify":
          self.close("primary_verify_user", {
            email: email,
            auth_url: info.auth
          });
          complete(true);
          break;
        case "primary.could_not_add":
          // XXX Can this happen?
          break;
        default:
          break;
      }
    }, self.getErrorDialog(errors.createUser, callback));
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
    if(user.getStoredEmailKeypair(email)) {
      // User already owns this address
      tooltip.showTooltip("#already_own_address");
      callback(false);
    }
    else {
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
  }

  function cancelEvent(callback) {
    return function(event) {
      event && event.preventDefault();
      callback.call(this);
    };
  }

  helpers.Dialog = helpers.Dialog || {};

  helpers.extend(helpers.Dialog, {
    getAssertion: getAssertion,
    authenticateUser: authenticateUser,
    createUser: createUser,
    addEmail: addEmail,
    resetPassword: resetPassword,
    cancelEvent: cancelEvent
  });

}());
