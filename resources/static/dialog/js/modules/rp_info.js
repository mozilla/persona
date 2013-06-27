/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


/**
 * Purpose:
 *  Display to the user RP related data such as hostname, sitename, logo,
 *  TOS/PP, etc.
 */
BrowserID.Modules.RPInfo = (function() {
  "use strict";

  var bid = BrowserID,
      dom = bid.DOM,
      renderer = bid.Renderer,
      BODY_SELECTOR = "body",
      FAVICON_CLASS = "showMobileFavicon",
      TEXT_COLOR = {dark: '#383838', light: '#c7c7c7'},
      sc;

  function foregroundColor(bg) {

    // Convert to RGB number values
    var list = [0, 0, 0];
    for (var i = 0; i < 3; i++) {
      list[i] = parseInt(bg.substr(i * 2, 2), 16);
    }

    // Determine the luminance (L in HSL)
    var r = list[0] / 255, g = list[1] / 255, b = list[2] / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    if ((max + min) / 2 > 0.5) {
      return TEXT_COLOR.dark; // high L => light background => dark text
    } else {
      return TEXT_COLOR.light; // low L => dark background => light text
    }

  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      options = options || {};

      /**
       * Very important security info - it is assumed all parameters are
       * already properly escaped before being passed here.  This is done
       * in dialog.js.  Check it.
       *
       * hostname is set internally based on the RP URL,
       * so it will not be escaped.  It is set initially in user.js at the very
       * bottom for the main site, and then in dialog.js->get for the dialog.
       */
      var templateData = {
        hostname: options.hostname,
        siteName: options.siteName,
        siteLogo: options.siteLogo,
        privacyPolicy: options.privacyPolicy,
        termsOfService: options.termsOfService
      };

      renderer.render(".rpInfo", "rp_info", templateData);
      if (options.backgroundColor) {
        $('.rpBackground').css('background-color', '#' + options.backgroundColor);
        $('.favicon').css('color', foregroundColor(options.backgroundColor));
      }

      /**
       * Mobile devices show the RP TOS/PP below the Persona TOS/PP
       * information. A special template is used.
       */
      renderer.render(".isMobile.rpInfo", "rp_info_mobile", templateData);

      /**
       * If the user is signing in to FirefoxOS Marketplace on a mobile device,
       * add a special class to the body which hides the normal favicon
       */
      dom[options.mobileFavicon ? "addClass" : "removeClass"]
          (BODY_SELECTOR, FAVICON_CLASS);

      sc.start.call(this, options);
    }

    // BEGIN TESTING API
    ,
    TEXT_COLOR: TEXT_COLOR,
    foregroundColor: foregroundColor
    // END TESTING API

  });

  sc = Module.sc;

  return Module;

}());

