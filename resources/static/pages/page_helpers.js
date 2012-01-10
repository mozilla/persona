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
      helpers = bid.Helpers,
      dom = bid.DOM,
      errorDisplay = bid.ErrorDisplay,
      ANIMATION_SPEED = 250,
      origStoredEmail;

  function setStoredEmail(email) {
    locStorage.signInEmail = email;
  }

  function onEmailChange(event) {
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

    dom.bindEvent("#email", "keyup", onEmailChange);
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

  function showFailure(error, info, callback) {
    info = $.extend(info || {}, { action: error, dialog: false });
    bid.Screens.error.show("error", info);
    $("#errorBackground").stop().fadeIn();
    $("#error").stop().fadeIn();

    callback && callback(false);
  }

  function getFailure(error, callback) {
    return function onFailure(info) {
      showFailure(error, info, callback);
    }
  }

  function replaceFormWithNotice(selector, onComplete) {
    $("form").hide();
    $(selector).fadeIn(ANIMATION_SPEED);
    // If there is more than one .forminputs, the onComplete callback is called
    // multiple times, we only want once.
    onComplete && setTimeout(onComplete, ANIMATION_SPEED);
  }

  function replaceInputsWithNotice(selector, onComplete) {
    $('.forminputs').hide();
    $(selector).stop().hide().css({opacity:1}).fadeIn(ANIMATION_SPEED);
    // If there is more than one .forminputs, the onComplete callback is called
    // multiple times, we only want once.
    onComplete && setTimeout(onComplete, ANIMATION_SPEED);
  }

  function showInputs(onComplete) {
    $('.notification').hide();
    $('.forminputs').stop().hide().css({opacity:1}).fadeIn(ANIMATION_SPEED);
    // If there is more than one .forminputs, the onComplete callback is called
    // multiple times, we only want once.
    onComplete && setTimeout(onComplete, ANIMATION_SPEED);
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

  function openPrimaryAuth(winchan, email, baseURL, callback) {
    if(!(email && baseURL)) {
      throw "cannot verify with primary without an email address and URL"
    }

    var url = helpers.toURL(baseURL, {
        email: email,
        return_to: "https://browserid.org/authenticate_with_primary#complete"
    });

    var win = winchan.open({
      url: "https://browserid.org/authenticate_with_primary",
      // This is the relay that will be used when the IdP redirects to sign_in_complete
      relay_url: "https://browserid.org/relay",
      window_features: "width=700,height=375",
      params: url
    }, callback);
  }

  return {
    setupEmail: prefillEmail,
    setStoredEmail: setStoredEmail,
    clearStoredEmail: clearStoredEmail,
    getStoredEmail: getStoredEmail,
    getParameterByName: getParameterByName,
    /**
     * shows a failure screen immediately
     * @method showFailure
     */
    showFailure: showFailure,
    /**
     * get a function to show an error screen when function is called.
     * @method getFailure
     */
    getFailure: getFailure,
    replaceInputsWithNotice: replaceInputsWithNotice,
    replaceFormWithNotice: replaceFormWithNotice,
    showInputs: showInputs,
    showEmailSent: showEmailSent,
    cancelEmailSent: cancelEmailSent,
    cancelEvent: cancelEvent,
    openPrimaryAuth: openPrimaryAuth
  };
}());
