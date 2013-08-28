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
      RP_BACKGROUND_SELECTOR = ".rpBackground",
      RP_FOREGROUND_SELECTOR = ".favicon",
      FAVICON_CLASS = "showMobileFavicon",
      sc;

  function inverseGamma(color) {
    return color <= 0.03928 ? (color / 12.92) : Math.pow((color + 0.055) / 1.055, 2.4);
  }

  function luminanceForRgb(rgbColor) {
    // Determine relative luminance per WCAG20
    // http://w3.org/TR/WCAG20/#relativeluminancedef
    var luminance = (0.2126 * inverseGamma(rgbColor.r))
          + (0.7152 * inverseGamma(rgbColor.g))
          + (0.0722 * inverseGamma(rgbColor.b));

    return luminance;
  }

  function convertToRGB(color) {
    var rgb = { r: 0, g: 0, b: 0 };
    var colors = ['r', 'g', 'b'];
    for (var i = 0; i < 3; i++) {
      rgb[colors[i]] = parseInt(color.substr(i * 2, 2), 16) / 255;
    }
    return rgb;
  }

  function foregroundColorClass(bg) {
    var bgRgb = convertToRGB(bg);
    var luminance = luminanceForRgb(bgRgb);

    return luminance > 0.5 ? 'dark' : 'light';
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
        dom.setStyle(RP_BACKGROUND_SELECTOR, 'background-color', '#' + options.backgroundColor);

        dom.removeClass(RP_FOREGROUND_SELECTOR, 'dark');
        dom.removeClass(RP_FOREGROUND_SELECTOR, 'light');
        dom.addClass(RP_FOREGROUND_SELECTOR, foregroundColorClass(options.backgroundColor));
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
    foregroundColorClass: foregroundColorClass
    // END TESTING API

  });

  sc = Module.sc;

  return Module;

}());

