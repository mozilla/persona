/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global BrowserID:true, PageController: true */
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
      cancelEvent = helpers.cancelEvent,
      dom = bid.DOM,
      lastEmail = "";

  function getEmail() {
    return helpers.getAndValidateEmail("#email");
  }

  function checkEmail() {
    var email = getEmail(),
        self = this;

    if (!email) return;

    user.addressInfo(email, function(info) {
      if(info.type === "primary") {
        // XXX this will redirect already users already signed in to their IdP
        // without ever giving them a cancel option.  Kind of crappy.
        self.close("primary_user", _.extend(info, { email: email }));
      }
      else {
        if(info.known) {
          enterPasswordState.call(self);
        }
        else {
          createSecondaryUserState.call(self);
        }
      }
    }, self.getErrorDialog(errors.addressInfo));
  }

  function createSecondaryUser(callback) {
    var self=this,
        email = getEmail();

    if (email) {
      dialogHelpers.createUser.call(self, email, callback);
    } else {
      callback && callback();
    }
  }

  function authenticate() {
    var email = getEmail(),
        pass = helpers.getAndValidatePassword("#password"),
        self = this;

    if (email && pass) {
      dialogHelpers.authenticateUser.call(self, email, pass, function(authenticated) {
        if (authenticated) {
          self.close("authenticated", {
            email: email
          });
        }
      });
    }
  }

  function animateSwap(fadeOutSelector, fadeInSelector, callback) {
    // XXX instead of using jQuery here, think about using CSS animations.
    $(fadeOutSelector).fadeOut(ANIMATION_TIME, function() {
      $(fadeInSelector).fadeIn(ANIMATION_TIME, callback);
    });
  }

  function enterEmailState(el) {
    if (!el.is(":disabled")) {
      this.submit = checkEmail;
      animateSwap(".returning:visible,.newuser:visible", ".start");
    }
  }

  function enterPasswordState() {
    var self=this;

    self.publish("enter_password");
    self.submit = authenticate;
    animateSwap(".start:visible,.newuser:visible,.forgot:visible", ".returning", function() {
      dom.getElements("#password")[0].focus();
    });
  }

  function forgotPassword() {
    var email = getEmail();
    if (email) {
      this.close("forgot_password", { email: email });
    }
  }

  function createSecondaryUserState() {
    var self=this;

    self.publish("create_user");
    self.submit = createSecondaryUser;
    animateSwap(".start:visible,.returning:visible", ".newuser");
  }


  function emailKeyUp(event) {
    var newEmail = dom.getInner(event.target);
    if (newEmail !== lastEmail) {
      lastEmail = newEmail;
      enterEmailState.call(this, $(event.target));
    }
  }

  var Authenticate = bid.Modules.PageModule.extend({
    start: function(options) {
      options = options || {};

      var self=this;
      self.renderDialog("authenticate", {
        sitename: user.getHostname(),
        email: options.email || ""
      });

      self.submit = checkEmail;
      // If we already have an email address, check if it is valid, if so, show
      // password.
      if (options.email) self.submit();


      self.bind("#email", "keyup", emailKeyUp);
      self.bind("#forgotPassword", "click", cancelEvent(forgotPassword));

      Authenticate.sc.start.call(self, options);
    }

    // BEGIN TESTING API
    ,
    checkEmail: checkEmail,
    createUser: createSecondaryUser,
    authenticate: authenticate,
    forgotPassword: forgotPassword
    // END TESTING API
  });

  return Authenticate;

}());
