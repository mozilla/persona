/**
 * Uncompressed source can be found at:
 *    https://login.persona.org/authentication_api.orig.js
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  if (!navigator.id) {
    navigator.id = {};
  }

  function getParameterByName(name)
  {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regexS = "[\\?&]" + name + "=([^&#]*)";
    var regex = new RegExp(regexS);
    var results = regex.exec(window.location.href);
    if(results == null)
      return "";
    else
      return decodeURIComponent(results[1].replace(/\+/g, " "));
  }

  if (!navigator.id.beginAuthentication || navigator.id._primaryAPIIsShimmed) {
    navigator.id.beginAuthentication = function(cb) {
      if (typeof cb !== 'function') {
        throw ".beginAuthentication() requires a callback argument";
      }
      var email = getParameterByName('email');
      setTimeout(function() { cb(email); }, 0);
    };

    var ipServer = 'https://login.persona.org';
    // FirefoxOS UA string:
    // "Mozilla/5.0 (Mobile; rv:18.0) Gecko/18.0 Firefox/18.0
    // Android UA string:
    // Mozilla/5.0 (Android; Mobile; rv:18.0) Gecko/18.0 Firefox/18.0
    if (!!navigator.mozId && (navigator.userAgent.indexOf("(Mobile;") > -1)) {
      // FirefoxOS devices point to firefoxos.persona.org and must be
      // redirected there. When  when running in dev/staging, firefoxos
      // will be replaced to point to the same url as login.persona.org
      ipServer = 'https://firefoxos.persona.org';
    }

    // window.name is set when the dialog window is opened. window.name must be
    // set from window.open and cannot be set from within the dialog or else
    // it is lost in IE whenever the page redirects to the IdP.
    // See issue #2287 - https://github.com/mozilla/browserid/issues/2287
    navigator.id.completeAuthentication = function(cb) {
      window.location = ipServer + '/sign_in#AUTH_RETURN';
    };

    navigator.id.raiseAuthenticationFailure = function(reason) {
      window.location = ipServer + '/sign_in#AUTH_RETURN_CANCEL';
    };

    navigator.id._primaryAPIIsShimmed = true;
  }
}());
