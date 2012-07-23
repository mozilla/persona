/*jshint browser:true, jquery: true, forin: true, laxbreak:true */
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
      hints = ["returning","start","addressInfo"],
      currentHint;

  function getEmail() {
    return helpers.getAndValidateEmail("#email");
  }

  function initialState(info) {
    /*jshint validthis: true*/
    var self=this;

    self.submit = checkEmail;
    if(info && info.email && info.type === "secondary" && info.known) {
      enterPasswordState.call(self, info.ready);
    }
    else {
      showHint("start");
      enterEmailState.call(self);
      complete(info.ready);
    }
  }

  function checkEmail(info) {
    /*jshint validthis: true*/
    var email = getEmail(),
        self = this;

    if (!email) return;

    dom.setAttr('#email', 'disabled', 'disabled');
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
      dom.removeAttr('#email', 'disabled');

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
    /*jshint validthis: true*/
    var self=this,
        email = getEmail();

    if (email) {
      self.close("new_user", { email: email }, { email: email });
    } else {
      complete(callback);
    }
  }

  function authenticate() {
    /*jshint validthis: true*/
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
    // Only show the hint if it is not already shown. Showing the same hint
    // on every keypress massively slows down Fennec. See issue #2010
    // https://github.com/mozilla/browserid/issues/2010
    if (currentHint === showSelector) return;
    currentHint = showSelector;

    _.each(hints, function(className) {
      if(className != showSelector) {
        dom.hide("." + className + ":not(." + showSelector + ")");
      }
    });

    $("." + showSelector).fadeIn(ANIMATION_TIME, function() {
      // Fire a window resize event any time a new section is displayed that
      // may change the content's innerHeight.  this will cause the "screen
      // size hacks" to resize the screen appropriately so scroll bars are
      // displayed when needed.
      dom.fireEvent(window, "resize");
      complete(callback);
    });
  }

  function enterEmailState() {
    /*jshint validthis: true*/
    if (!dom.is("#email", ":disabled")) {
      this.submit = checkEmail;
      showHint("start");
    }
  }

  function enterPasswordState(callback) {
    /*jshint validthis: true*/
    var self=this;

    dom.setInner("#password", "");

    self.publish("enter_password", addressInfo);
    self.submit = authenticate;
    showHint("returning", function() {
      dom.focus("#password");
    });


    complete(callback);
  }

  function forgotPassword() {
    /*jshint validthis: true*/
    var email = getEmail();
    if (email) {
      var info = addressInfo || { email: email };
      this.close("forgot_password", info, info );
    }
  }

  function emailKeyUp() {
    /*jshint validthis: true*/
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
        siteName: options.siteName,
        email: lastEmail
      });

      dom.hide(".returning,.start");

      // We have to show the TOS/PP agreements to *all* users here. Users who
      // are already authenticated to their IdP but do not have a Persona
      // account automatically have an account created with no further
      // interaction.  To make sure they see the TOS/PP agreement, show it
      // here.
      if (options.siteTOSPP) {
        dialogHelpers.showRPTosPP.call(self);
      }

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
