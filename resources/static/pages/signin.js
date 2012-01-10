/*globals BrowserID:true, $:true*/
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

BrowserID.signIn = (function() {
  "use strict";

  var bid = BrowserID,
      dom = bid.DOM,
      user = bid.User,
      network = bid.Network,
      helpers = bid.Helpers,
      errors = bid.Errors,
      pageHelpers = bid.PageHelpers,
      cancelEvent = pageHelpers.cancelEvent,
      doc = document,
      winchan = window.WinChan,
      verifyEmail,
      verifyURL,
      addressInfo,
      sc,
      lastEmail;

  function complete(oncomplete, status) {
    oncomplete && oncomplete(status);
  }

  function provisionPrimaryUser(email, info, callback) {
    // primary user who is authenticated with the primary.
    user.provisionPrimaryUser(email, info, function(status, provInfo) {
      if (status === "primary.verified") {
        network.authenticateWithAssertion(email, provInfo.assertion, function(status) {
          doc.location = "/";

          complete(callback);
        }, pageHelpers.getFailure(errors.authenticateWithAssertion, callback));
      }
      else {
        $("#primary_no_login").fadeIn();
      }
    }, pageHelpers.getFailure(errors.provisioningPrimary, callback));
  }

  function emailSubmit(oncomplete) {
    var self=this,
        email = helpers.getAndValidateEmail("#email");

    if(email) {
      user.addressInfo(email, function(info) {
        addressInfo = info;

        if(info.type === "secondary") {
          if(info.known) {
            dom.addClass("body", "known_secondary");
            dom.focus("#password");
            self.submit = passwordSubmit;
          }
          else {
            dom.setInner("#unknown_email", email);
            dom.addClass("body", "unknown_secondary");
          }

          complete(oncomplete);
        }
        else if(info.authed) {
          // primary user who is authenticated with the primary, immediately
          // provision and authenticate them to BrowserID.
          provisionPrimaryUser(email, info, oncomplete);
        }
        else {
          dom.addClass("body", "verify_primary");
          dom.setInner("#primary_email", email);
          self.submit = authWithPrimary;

          verifyEmail = email;
          verifyURL = info.auth;

          complete(oncomplete);
        }
      }, pageHelpers.getFailure(errors.addressInfo, oncomplete));
    }
    else {
      complete(oncomplete);
    }
  }

  function passwordSubmit(oncomplete) {
    var email = helpers.getAndValidateEmail("#email"),
        password = helpers.getAndValidatePassword("#password");

    if (email && password) {
      user.authenticate(email, password, function onSuccess(authenticated) {
        if (authenticated) {
          pageHelpers.clearStoredEmail();
          doc.location = "/";
        }
        else {
          // bad authentication
          $(".notifications .notification.badlogin").fadeIn();
        }
        complete(oncomplete);
      }, pageHelpers.getFailure(errors.authenticate, oncomplete));
    }
    else {
      complete(oncomplete);
    }
  }

  function authWithPrimary(oncomplete) {
    pageHelpers.openPrimaryAuth(winchan, verifyEmail, verifyURL, primaryAuthComplete);

    complete(oncomplete);
  }

  function primaryAuthComplete(error, result, oncomplete) {
    if(error) {
      pageHelpers.showFailure(errors.primaryAuthentication, error, oncomplete);
    }
    else {
      provisionPrimaryUser(verifyEmail, addressInfo, oncomplete);
    }
  }

  function onEmailChange(event) {
    // this is basically a state reset.
    var email = dom.getInner("#email");
    if(email !== lastEmail) {
      dom.removeClass("body", "verify_primary");
      dom.removeClass("body", "known_secondary");
      dom.removeClass("body", "unknown_secondary");
      this.submit = emailSubmit;
      lastEmail = email;
    }
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      var self=this;

      if(options && options.document) doc = options.document;
      if(options && options.winchan) winchan = options.winchan;

      pageHelpers.setupEmail();

      self.bind("#authWithPrimary", "click", cancelEvent(authWithPrimary));
      self.bind("#email", "change", onEmailChange);
      self.bind("#email", "keyup", onEmailChange);

      sc.start.call(self, options);
    },
    submit: emailSubmit

    // BEGIN TESTING API
    ,
    emailSubmit: emailSubmit,
    passwordSubmit: passwordSubmit,
    authWithPrimary: authWithPrimary,
    primaryAuthComplete: primaryAuthComplete
    // END TESTING API
  });


  sc = Module.sc;

  return Module;

}());


