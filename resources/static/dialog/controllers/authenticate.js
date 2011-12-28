/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global BrowserID:true, PageController: true */
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
      cancelEvent = dialogHelpers.cancelEvent,
      dom = bid.DOM,
      lastEmail = "",
      emailInfo;

  function getEmail() {
    return helpers.getAndValidateEmail("#email");
  }

  function checkEmail() {
    var email = getEmail(),
        self = this;

    if (!email) return;

    user.addressInfo(email, function(info) {
      if(info.type === "primary") {
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
