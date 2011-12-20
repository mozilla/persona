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

BrowserID.signUp = (function() {
  "use strict";

  var bid = BrowserID,
      user = bid.User,
      dom = bid.DOM,
      helpers = bid.Helpers,
      pageHelpers = bid.PageHelpers,
      cancelEvent = pageHelpers.cancelEvent,
      errors = bid.Errors,
      tooltip = BrowserID.Tooltip,
      ANIMATION_SPEED = 250,
      storedEmail = pageHelpers;

    function showNotice(selector) {
      $(selector).fadeIn(ANIMATION_SPEED);
    }

    function submit(oncomplete) {
      var email = helpers.getAndValidateEmail("#email");

      function complete() {
        oncomplete && oncomplete();
      }

      if (email) {
        user.addressInfo(email, function(info) {
          if (info.type === 'secondary') {
            if (!info.known) {
              user.createUser(email, function onSuccess(success) {
                if(success) {
                  pageHelpers.showEmailSent(oncomplete);
                }
                else {
                  tooltip.showTooltip("#could_not_add");
                  complete();
                }
              }, pageHelpers.getFailure(errors.createUser, oncomplete));
            }
            else {
              $('#registeredEmail').html(email);
              showNotice(".alreadyRegistered");
              complete();
            }
          } else {
            BrowserID.Provisioning({
              email: email,
              url: info.prov
            }, function(r) {
              // XXX: implement me
              alert("shane!  provisioning was a success " + JSON.stringify(r));
            }, function(e) {
              // XXX: implement me
              alert("shane!  provisioning was a failure: " + e);
            });
          }
        }, pageHelpers.getFailure(errors.isEmailRegistered, oncomplete));
      }
      else {
        complete();
      }
    }

    function back(oncomplete) {
      pageHelpers.cancelEmailSent(oncomplete);
    }

    function onEmailKeyUp(event) {
      if (event.which !== 13) $(".notification").fadeOut(ANIMATION_SPEED);
    }

    function init() {
      $("form input[autofocus]").focus();

      pageHelpers.setupEmail();

      dom.bindEvent("#email", "keyup", onEmailKeyUp);
      dom.bindEvent("form", "submit", cancelEvent(submit));
      dom.bindEvent("#back", "click", cancelEvent(back));
    }

    // BEGIN TESTING API
    function reset() {
      dom.unbindEvent("#email", "keyup");
      dom.unbindEvent("form", "submit");
      dom.unbindEvent("#back", "click");
    }

    init.submit = submit;
    init.reset = reset;
    init.back = back;
    // END TESTING API

    return init;
}());
