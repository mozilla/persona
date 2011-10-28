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

(function() {
  "use strict";

  var bid = BrowserID,
      user = bid.User,
      ANIMATION_SPEED = 250;

  bid.signUp = function () {

    function replaceWithMessage(selector) {
        $('.forminputs').fadeOut(ANIMATION_SPEED, function() {
          $(selector).fadeIn(ANIMATION_SPEED);
        });
    }

    function showNotice(selector) {
      $(selector).fadeIn(ANIMATION_SPEED);
    }

    function onFailure() {
      replaceWithMessage(".doh");
    }


    $(function () {
      $("form input[autofocus]").focus();

      $("#email").bind("keyup", function(event) {
        if (event.which !== 13) {
          $(".notification").fadeOut(ANIMATION_SPEED);
        }
      });

      $("#signUpForm").bind("submit", function(event) {
        event.preventDefault();

        var email = $("#email").val(),
            valid = bid.Validation.email(email);

        if (!valid) {
          return;
        }

        user.isEmailRegistered(email, function(registered) {
          if (!registered) {
            user.createUser(email, function onSuccess(keypair) {
              $('#sentToEmail').html(email);
              replaceWithMessage(".emailsent");
            }, onFailure);
          }
          else {
            $('#registeredEmail').html(email);
            showNotice(".alreadyRegistered");
            window.localStorage.signInEmail = email;
          }
        }, onFailure);
      });

    });
  };
}());
