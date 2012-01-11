/*globals BrowserID: true, _: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.PageHelpers = (function() {
  "use strict";

  var win = window,
      locStorage = win.localStorage,
      bid = BrowserID,
      user = bid.User,
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

    dom.bindEvent("#email", "change", onEmailChange);
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
    }, function(error, result) {
      // We have to force a reset of the primary caches because the user's
      // authentication status may be incorrect.
      // XXX a better solution here would be to change the authentication
      // status of the user inside of the cache.
      if(!error) {
        user.resetCaches();
      }
      callback && callback(error, result);
    });
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
