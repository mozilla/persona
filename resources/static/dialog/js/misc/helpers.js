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
      errors = bid.Errors,
      dom = bid.DOM;

  function authenticateUser(email, pass, callback) {
    /*jshint validthis:true*/
    var self=this;
    self.publish("password_submit");
    user.authenticate(email, pass,
      function (authenticated) {
        if (authenticated) {
          self.publish("authentication_success");
        }
        else {
          self.publish("authentication_fail");
          tooltip.showTooltip("#cannot_authenticate");
        }
        complete(callback, authenticated);
      }, self.getErrorDialog(errors.authenticate, callback));
  }

  function createUser(email, password, callback) {
    /*jshint validthis:true*/
    var self=this;
    user.createSecondaryUser(email, password, function(status) {
      if (status.success) {
        var data = { email: email, password: password };
        var msg = status.unverified ? "unverified_created" : "user_staged";
        self.publish(msg, data, data);
      }
      else {
        tooltip.showTooltip("#could_not_add");
      }
      complete(callback, status);
    }, self.getErrorDialog(errors.createUser, callback));
  }

  function resetPassword(email, callback) {
    /*jshint validthis:true*/
    var self=this;
    user.requestPasswordReset(email, function(status) {
      if (status.success) {
        self.publish("reset_password_staged", { email: email });
      }
      else {
        tooltip.showTooltip("#could_not_add");
      }
      complete(callback, status);
    }, self.getErrorDialog(errors.requestPasswordReset, callback));
  }

  function transitionToSecondary(email, password, callback) {
    /*jshint validthis:true*/
    var self=this;
    user.requestTransitionToSecondary(email, password, function(status) {
      if (status.success) {
        self.publish("transition_to_secondary_staged", { email: email });
      }
      else {
        tooltip.showTooltip("#could_not_add");
      }
      complete(callback, status);
    }, self.getErrorDialog(errors.transitionToSecondary, callback));
  }

  function reverifyEmail(email, callback) {
    /*jshint validthis:true*/
    var self=this;
    user.requestEmailReverify(email, function(status) {
      if (status.success) {
        self.publish("reverify_email_staged", { email: email });
      }
      else {
        tooltip.showTooltip("#could_not_add");
      }
      complete(callback, status);
    }, self.getErrorDialog(errors.requestPasswordReset, callback));
  }

  function addEmail(email, callback) {
    /*jshint validthis:true*/
    var self=this;

    // go get the normalized address and then do the rest of the checks.
    user.addressInfo(email, function(info) {
      email = info.email;

      if (user.getStoredEmailKeypair(email)) {
        // User already owns this address
        tooltip.showTooltip("#already_own_address");
        complete(callback, false);
      }
      else if (info.type === "primary") {
        info = _.extend(info, { email: email, add: true });
        self.publish("primary_user", info, info);
        complete(callback, true);
      }
      else {
        self.publish("stage_email", { email: email });
        complete(callback, true);
      }
    }, self.getErrorDialog(errors.addressInfo, callback));
  }

  function refreshEmailInfo(email, callback) {
    /*jshint validthis:true*/
    var self=this;
    user.addressInfo(email, function (info) {
      callback(_.extend({ email: email }, info));
    }, self.getErrorDialog(errors.addressInfo, callback));
  }

  function addSecondaryEmail(email, password, callback) {
    /*jshint validthis:true*/
    var self=this;

    user.addEmail(email, password, function(status) {
      if (status.success) {
        var info = { email: email, password: password };
        self.publish("email_staged", info, info );
      }
      else {
        tooltip.showTooltip("#could_not_add");
      }
      complete(callback, status);
    }, self.getErrorDialog(errors.addEmail, callback));
  }

  function showRPTosPP() {
    dom.addClass("body", "rptospp");
  }

  helpers.Dialog = helpers.Dialog || {};

  _.extend(helpers.Dialog, {
    authenticateUser: authenticateUser,
    createUser: createUser,
    addEmail: addEmail,
    refreshEmailInfo: refreshEmailInfo,
    addSecondaryEmail: addSecondaryEmail,
    resetPassword: resetPassword,
    transitionToSecondary: transitionToSecondary,
    reverifyEmail: reverifyEmail,
    cancelEvent: helpers.cancelEvent,
    showRPTosPP: showRPTosPP
  });

}());
