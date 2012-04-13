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
      complete = helpers.complete,
      dom = bid.DOM,
      lastEmail = "",
      addressInfo,
      hints = ["returning","start","addressInfo"];

  function getEmail() {
    return helpers.getAndValidateEmail("#email");
  }

  function initialState(info) {
    var self=this;

    self.submit = checkEmail;
    if(info && info.email && info.type === "secondary" && info.known) {
      enterPasswordState.call(self, info.ready);
    }
    else {
      showHint("start");
      complete(info.ready);
    }
  }

  function checkEmail(info) {
    var email = getEmail(),
        self = this;

    if (!email) return;

    if(info && info.type) {
      onAddressInfo(info);
    }
    else {
      showHint("addressInfo");
      user.addressInfo(email, onAddressInfo,
        self.getErrorDialog(errors.addressInfo));
    }

    function onAddressInfo(info) {
      addressInfo = info;

      if(info.type === "primary") {
        self.close("primary_user", info, info);
      }
      else if(info.known) {
        enterPasswordState.call(self);
      } else {
        createSecondaryUser.call(self);
      }
    }
  }

  function createSecondaryUser(callback) {
    var self=this,
        email = getEmail();

    if (email) {
      self.close("new_user", { email: email });
    } else {
      complete(callback);
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

  function showHint(showSelector, callback) {
    _.each(hints, function(className) {
      if(className != showSelector) {
        $("." + className).not("." + showSelector).hide();
      }
    });

    $("." + showSelector).fadeIn(ANIMATION_TIME, callback);
  }

  function enterEmailState(el) {
    if (!$("#email").is(":disabled")) {
      this.submit = checkEmail;
      showHint("start");
    }
  }

  function enterPasswordState(callback) {
    var self=this;

    self.publish("enter_password", addressInfo);
    self.submit = authenticate;
    showHint("returning", function() {
      dom.focus("#password");
    });
    complete(callback);
  }

  function forgotPassword() {
    var email = getEmail();
    if (email) {
      var info = addressInfo || { email: email };
      this.close("forgot_password", info, info );
    }
  }

  function emailKeyUp() {
    var newEmail = dom.getInner("#email");
    if (newEmail !== lastEmail) {
      lastEmail = newEmail;
      enterEmailState.call(this);
    }
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      options = options || {};

      addressInfo = null;
      lastEmail = options.email || "";

      var self=this;
      self.renderDialog("authenticate", {
        sitename: user.getHostname(),
        email: lastEmail,
        privacy_url: options.privacyURL,
        tos_url: options.tosURL
      });

      $(".returning,.start").hide();

      self.bind("#email", "keyup", emailKeyUp);
      self.click("#forgotPassword", forgotPassword);

      Module.sc.start.call(self, options);
      initialState.call(self, options);
    }

    // BEGIN TESTING API
    ,
    checkEmail: checkEmail,
    createUser: createSecondaryUser,
    authenticate: authenticate,
    forgotPassword: forgotPassword
    // END TESTING API
  });

  return Module;

}());
