/*jshint browsers:true, forin: true, laxbreak: true */
/*global BrowserID: true*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      helpers = bid.Helpers,
      complete = helpers.complete,
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
      setTimeout(complete.curry(callback), 1750);
    }
    else {
      complete(callback);
    }
  }

  function getAssertion(email, callback) {
    var self=this;
    var wait = bid.Screens.wait;
    wait.show("wait", bid.Wait.generateKey);
    user.getAssertion(email, user.getOrigin(), function(assert) {
      assert = assert || null;
      wait.hide();
      self.publish("assertion_generated", {
        assertion: assert
      });

      complete(callback, assert);
    }, self.getErrorDialog(errors.getAssertion, complete));
  }

  function authenticateUser(email, pass, callback) {
    var self=this;
    user.authenticate(email, pass,
      function (authenticated) {
        if (!authenticated) {
          tooltip.showTooltip("#cannot_authenticate");
        }
        complete(callback, authenticated);
      }, self.getErrorDialog(errors.authenticate, callback));
  }

  function createUser(email, password, callback) {
    var self=this;
    user.createSecondaryUser(email, password, function(status) {
      if (status) {
        var info = { email: email };
        self.publish("user_staged", info, info);
        complete(callback, true);
      }
      else {
        // XXX will this tooltip ever be shown, the authentication screen has
        // already been torn down by this point?
        tooltip.showTooltip("#could_not_add");
        complete(callback, false);
      }
    }, self.getErrorDialog(errors.createUser, callback));
  }

  function resetPassword(email, password, callback) {
    var self=this;
    user.requestPasswordReset(email, password, function(status) {
      if (status.success) {
        self.publish("password_reset", { email: email });
      }
      else {
        tooltip.showTooltip("#could_not_add");
      }
      complete(callback, status.success);
    }, self.getErrorDialog(errors.requestPasswordReset, callback));
  }

  function addEmail(email, callback) {
    var self=this;

    if (user.getStoredEmailKeypair(email)) {
      // User already owns this address
      tooltip.showTooltip("#already_own_address");
      complete(callback, false);
    }
    else {
      user.addressInfo(email, function(info) {
        if (info.type === "primary") {
          var info = _.extend(info, { email: email, add: true });
          self.publish("primary_user", info, info);
          complete(callback, true);
        }
        else {
          self.publish("add_email_submit_with_secondary", { email: email });
          complete(callback, true);
        }
      }, self.getErrorDialog(errors.addressInfo, callback));
    }
  }

  function addSecondaryEmailWithPassword(email, password, callback) {
    var self=this;

    user.addEmail(email, password, function(added) {
      if (added) {
        var info = { email: email };
        self.publish("email_staged", info, info );
      }
      else {
        tooltip.showTooltip("#could_not_add");
      }
      complete(callback, added);
    }, self.getErrorDialog(errors.addEmail, callback));
  }

  helpers.Dialog = helpers.Dialog || {};

  helpers.extend(helpers.Dialog, {
    getAssertion: getAssertion,
    authenticateUser: authenticateUser,
    createUser: createUser,
    addEmail: addEmail,
    addSecondaryEmailWithPassword: addSecondaryEmailWithPassword,
    resetPassword: resetPassword,
    cancelEvent: helpers.cancelEvent,
    animateClose: animateClose
  });

}());
