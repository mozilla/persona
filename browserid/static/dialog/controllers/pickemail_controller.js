/*jshint brgwser:true, jQuery: true, forin: true, laxbreak:true */                                             
/*global _: true, BrowserID: true, PageController: true */ 
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

  var ANIMATION_TIME = 250,
      bid = BrowserID,
      user = bid.User,
      errors = bid.Errors,
      body = $("body"),
      animationComplete = body.innerWidth() < 640,
      assertion;

  function animateSwap(fadeOutSelector, fadeInSelector, callback) {
    // XXX instead of using jQuery here, think about using CSS animations.
    $(fadeOutSelector).fadeOut(ANIMATION_TIME, function() {
      $(fadeInSelector).fadeIn(ANIMATION_TIME, callback);
    });
  }



  function cancelEvent(event) {
    if (event) {
      event.preventDefault();
    }
  }

  function pickEmailState(element, event) {
    cancelEvent(event);

    var self=this;
    animateSwap("#addEmail", "#selectEmail", function() {
      if(!self.find("input[type=radio]:checked").length) {
        // If none are already checked, select the first one.
        self.find('input[type=radio]').eq(0).attr('checked', true);
      }
      // focus whichever is checked.
      self.find("input[type=radio]:checked").focus();
      self.submit = signIn;
    });
  }

  function addEmailState(element, event) {
    cancelEvent(event);

    this.submit = addEmail;
    animateSwap("#selectEmail", "#addEmail", function() {
      $("#newEmail").focus();
    });
  }

  function checkEmail(email) {
    var identity = user.getStoredEmailKeypair(email);
    if(!identity) {
      alert("The selected email is invalid or has been deleted.");
      this.close("assertion_generated", {
        assertion: null
      });
    }

    return !!identity;
  }

  function tryClose() {
    if(typeof assertion !== "undefined" && animationComplete) {
      this.close("assertion_generated", {
        assertion: assertion
      });
    }
  }

  function getAssertion(email) {
    // Kick of the assertion fetching/keypair generating while we are showing 
    // the animation, hopefully this minimizes the delay the user notices.
    var self=this;
    user.getAssertion(email, function(assert) {
      assertion = assert || null;
      startAnimation.call(self);
    }, self.getErrorDialog(errors.getAssertion));
  }

  function startAnimation() {
    var self=this;
    if(!animationComplete) {
      $("#signIn").animate({"width" : "685px"}, "slow", function () {
        // post animation
         body.delay(500).animate({ "opacity" : "0.5"}, "fast", function () {
           animationComplete = true;
           tryClose.call(self);
         });
      }); 
    }
    else {
      tryClose.call(self);
    }

  }

  function signIn(element, event) {
    cancelEvent(event);
    var self=this,
        email = $("input[type=radio]:checked").val();

    var valid = checkEmail.call(self, email);
    if (valid) {
      getAssertion.call(self, email);
    }
  }

  function addEmail(element, event) {
    var email = $("#newEmail").val(),
        self=this;

    cancelEvent(event);

    if(!bid.Validation.email(email)) {
      return;
    }

    user.isEmailRegistered(email, function onComplete(registered) {
      if(registered) {
        bid.Tooltip.showTooltip("#already_taken");
      }
      else {
        user.addEmail(email, function(added) {
          if (added) {
            self.close("email_staged", {
              email: email
            });
          }
          else {
            bid.Tooltip.showTooltip("#could_not_add");
          }
        }, function onFailure() {
            bid.Tooltip.showTooltip("#could_not_add");
        });
      }
    }, self.getErrorDialog(errors.isEmailRegistered));
  }


  PageController.extend("Pickemail", {}, {
    init: function(el, options) {
      this._super(el, {
        bodyTemplate: "pickemail.ejs",
        bodyVars: {
          identities: user.getStoredEmailKeypairs()
        }
      });

      $("body").css("opacity", "1");

      if($("#selectEmail input[type=radio]:visible").length === 0) {
        // If there is only one email address, the radio button is never shown, 
        // instead focus the sign in button so that the user can click enter.
        // issue #412
        $("#signInButton").focus();
      }

      pickEmailState.call(this);
    },

    "#useNewEmail click": addEmailState,
    "#cancelNewEmail click": pickEmailState
  });

}());
