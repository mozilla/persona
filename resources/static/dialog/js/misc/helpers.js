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

  function animateClose(callback) {
    var body = $("body"),
        bodyWidth = body.innerWidth(),
        doAnimation = $("#signIn").length && bodyWidth > 640;

    if (doAnimation) {
      /**
       * Force the arrow to slide all the way off the screen.
       */
      var endWidth = bodyWidth + $(".arrowContainer").outerWidth();

      body.addClass("completing");
      /**
       * CSS transitions are used to do the slide effect.  jQuery has a bug
       * where it does not do transitions correctly if the box-sizing is set to
       * border-box and the element has a padding
       */
      $("#signIn").css("width", endWidth + "px");

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
    /*jshint validthis:true*/
    var self=this,
        wait = bid.Screens.wait;

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
        var info = { email: email, password: password };
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

  function resetPassword(email, callback) {
    /*jshint validthis:true*/
    var self=this;
    user.requestPasswordReset(email, function(status) {
      if (status.success) {
        self.publish("reset_password_staged", { email: email });
      }
      else {
        // XXX the tooltip should talk about being unable to reset the
        // password.
        tooltip.showTooltip("#could_not_add");
      }
      complete(callback, status.success);
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
        // XXX the tooltip should talk about being unable to set the password.
        tooltip.showTooltip("#could_not_add");
      }
      complete(callback, status.success);
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
        // XXX the tooltip should show something about being unable to reverify
        // email
        tooltip.showTooltip("#could_not_add");
      }
      complete(callback, status.success);
    }, self.getErrorDialog(errors.requestPasswordReset, callback));
  }

  function addEmail(email, callback) {
    /*jshint validthis:true*/
    var self=this;

    if (user.getStoredEmailKeypair(email)) {
      // User already owns this address
      tooltip.showTooltip("#already_own_address");
      complete(callback, false);
    }
    else {
      user.addressInfo(email, function(info) {
        if (info.type === "primary") {
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

    user.addEmail(email, password, function(added) {
      if (added) {
        var info = { email: email, password: password };
        self.publish("email_staged", info, info );
      }
      else {
        tooltip.showTooltip("#could_not_add");
      }
      complete(callback, added);
    }, self.getErrorDialog(errors.addEmail, callback));
  }

  function showRPTosPP() {
    dom.addClass("body", "rptospp");
  }

  helpers.Dialog = helpers.Dialog || {};

  _.extend(helpers.Dialog, {
    getAssertion: getAssertion,
    authenticateUser: authenticateUser,
    createUser: createUser,
    addEmail: addEmail,
    refreshEmailInfo: refreshEmailInfo,
    addSecondaryEmail: addSecondaryEmail,
    resetPassword: resetPassword,
    transitionToSecondary: transitionToSecondary,
    reverifyEmail: reverifyEmail,
    cancelEvent: helpers.cancelEvent,
    animateClose: animateClose,
    showRPTosPP: showRPTosPP
  });

}());
