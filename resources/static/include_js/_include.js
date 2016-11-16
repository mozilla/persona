/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

  if (!navigator.id) {
    navigator.id = {};
  }

  if (!navigator.id.request || navigator.id._shimmed) {
    var ipServer = "https://login.persona.org";
    var userAgent = navigator.userAgent;
    // We must check for both XUL and Java versions of Fennec.  Both have
    // distinct UA strings.
    var isFennec = (userAgent.indexOf('Fennec/') != -1) ||  // XUL
                     (userAgent.indexOf('Firefox/') != -1 && userAgent.indexOf('Android') != -1);   // Java

    var windowOpenOpts =
      (isFennec ? undefined :
       "menubar=0,location=1,resizable=1,scrollbars=1,status=0,width=700,height=375");

    var WINDOW_NAME = "__persona_dialog";
    var w;

    function openPopup() {
      w = window.open(
        ipServer + '/sign_in',
        WINDOW_NAME,
        windowOpenOpts);
    }

    navigator.id = {
      request: function() {
        return openPopup();
      },
      watch: function(options) {
        // intentionally empty
      },
      // logout from the current website
      // The callback parameter is DEPRECATED, instead you should use the
      // the .onlogout observer of the .watch() api.
      logout: function(callback) {
        // intentionally empty
      },
      // get an assertion
      get: function(callback, passedOptions) {
        openPopup();
      },
      // backwards compatibility with old API
      getVerifiedEmail: function(callback) {
        openPopup();
      },
      // _shimmed was originally required in April 2011 (79d3119db036725c5b51a305758a7816fdc8920a)
      // so we could deal with firefox behavior - which was in certain reload scenarios to caching
      // properties on navigator.id.  The effect would be upon reload-via back/forward,
      // navigator.id would be populated with the previous sessions stale object, and thus
      // the shim would not be properly inserted.
      _shimmed: true
    };
  }
