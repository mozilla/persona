/*globals BrowserID: true, _: true */
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

BrowserID.PageHelpers = (function() {
  "use strict";

  var win = window,
      locStorage = win.localStorage,
      bid = BrowserID,
      dom = bid.DOM,
      errorDisplay = bid.ErrorDisplay,
      ANIMATION_SPEED = 250,
      origStoredEmail;

  function setStoredEmail(email) {
    locStorage.signInEmail = email;
  }

  function onEmailKeyUp(event) {
    var email = dom.getInner("#email");
    setStoredEmail(email);
  }

  function prefillEmail() {
    // If the user tried to sign in on the sign up page with an existing email,
    // place that email in the email field, then focus the password.
    var el = $("#email"),
        email = locStorage.signInEmail;

    if (email) {
      el.val(email);
      if ($("#password").length) $("#password").focus();
    }

    el.keyup(onEmailKeyUp);
  }

  function clearStoredEmail() {
    locStorage.removeItem("signInEmail");
  }

  function getStoredEmail() {
    return locStorage.signInEmail || "";
  }

  function getParameterByName( name ) {
    name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
    var regexS = "[\\?&]"+name+"=([^&#]*)";
    var regex = new RegExp( regexS );
    var results = regex.exec( win.location.href );
    if( results === null )
      return "";
    else
      return decodeURIComponent(results[1].replace(/\+/g, " "));
  }

  function getFailure(error, callback) {
    return function onFailure(info) {
      info = $.extend(info, { action: error, dialog: false });
      bid.Screens.error.show("error", info);
      $("#errorBackground").stop().fadeIn();
      $("#error").stop().fadeIn();

      callback && callback(false);
    }
  }

  function replaceFormWithNotice(selector, onComplete) {
    $("form").hide();
    $(selector).fadeIn(ANIMATION_SPEED, onComplete);
  }

  function replaceInputsWithNotice(selector, onComplete) {
    $('.forminputs').hide();
    $(selector).stop().hide().css({opacity:1}).fadeIn(ANIMATION_SPEED, onComplete);
  }

  function showInputs(onComplete) {
    $('.notification').hide();
    $('.forminputs').stop().hide().css({opacity:1}).fadeIn(ANIMATION_SPEED, onComplete);
  }

  function showEmailSent(onComplete) {
    origStoredEmail = getStoredEmail();
    dom.setInner('#sentToEmail', origStoredEmail);

    clearStoredEmail();

    replaceInputsWithNotice(".emailsent", onComplete);
  }

  function cancelEmailSent(onComplete) {
    setStoredEmail(origStoredEmail);

    showInputs(onComplete);

    dom.focus("input:visible:eq(0)");
  }

  function cancelEvent(callback) {
    return function(event) {
      event && event.preventDefault();
      callback && callback();
    };
  }

  return {
    setupEmail: prefillEmail,
    setStoredEmail: setStoredEmail,
    clearStoredEmail: clearStoredEmail,
    getStoredEmail: getStoredEmail,
    getParameterByName: getParameterByName,
    getFailure: getFailure,
    replaceInputsWithNotice: replaceInputsWithNotice,
    replaceFormWithNotice: replaceFormWithNotice,
    showInputs: showInputs,
    showEmailSent: showEmailSent,
    cancelEmailSent: cancelEmailSent,
    cancelEvent: cancelEvent
  };
}());
