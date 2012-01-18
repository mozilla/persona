/*globals BrowserID: true, $:true */
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

BrowserID.addEmailAddress = (function() {
  "use strict";

  var ANIMATION_TIME=250,
      bid = BrowserID,
      user = bid.User,
      storage = bid.Storage,
      errors = bid.Errors,
      pageHelpers = bid.PageHelpers,
      dom = bid.DOM,
      token,
      sc;

  function showError(el, oncomplete) {
    $(".hint,#signUpForm").hide();
    $(el).fadeIn(ANIMATION_TIME, oncomplete);
  }

  function emailRegistrationComplete(oncomplete, info) {
    var valid = info.valid;
    if (valid) {
      emailRegistrationSuccess(info, oncomplete.bind(null, true));
    }
    else {
      showError("#cannotconfirm", oncomplete.bind(null, false));
    }
  }

  function showRegistrationInfo(info) {
    dom.setInner(".email", info.email);

    if (info.origin) {
      dom.setInner(".website", info.origin);
      $(".siteinfo").show();
    }
  }

  function emailRegistrationSuccess(info, oncomplete) {
    dom.addClass("body", "complete");

    showRegistrationInfo(info);

    setTimeout(function() {
      pageHelpers.replaceFormWithNotice("#congrats", oncomplete);
    }, 2000);
  }

  function userMustEnterPassword() {
    var emails = storage.getEmails(),
        length = 0,
        anySecondaries = _.find(emails, function(item) { length++; return item.type === "secondary"; });

    return length && !anySecondaries;
  }

  function verifyWithoutPassword(oncomplete) {
    user.verifyEmailNoPassword(token,
      emailRegistrationComplete.bind(null, oncomplete),
      pageHelpers.getFailure(errors.verifyEmail, oncomplete)
    );
  }

  function verifyWithPassword(oncomplete) {
    var pass = dom.getInner("#password"),
        vpass = dom.getInner("#vpassword"),
        valid = bid.Validation.passwordAndValidationPassword(pass, vpass);

    if(valid) {
      user.verifyEmailWithPassword(token, pass,
        emailRegistrationComplete.bind(null, oncomplete),
        pageHelpers.getFailure(errors.verifyEmail, oncomplete)
      );
    }
    else {
      oncomplete && oncomplete(false);
    }
  }

  function startVerification(oncomplete) {
    user.tokenInfo(token, function(info) {
      if(info) {
        showRegistrationInfo(info);

        if(userMustEnterPassword()) {
          dom.addClass("body", "enter_password");
          oncomplete(true);
        }
        else {
          verifyWithoutPassword(oncomplete);
        }
      }
      else {
        showError("#cannotconfirm");
        oncomplete(false);
      }
    }, pageHelpers.getFailure(errors.getTokenInfo, oncomplete));
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      function oncomplete(status) {
        options.ready && options.ready(status);
      }

      this.checkRequired(options, "token");

      token = options.token;

      startVerification(oncomplete);

      sc.start.call(this, options);
    },

    submit: verifyWithPassword
  });

  sc = Module.sc;

  return Module;
}());
