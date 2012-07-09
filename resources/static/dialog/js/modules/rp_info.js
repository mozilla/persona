/*jshint browser:true, jquery: true, forin: true, laxbreak:true */
/*global _: true, BrowserID: true, PageController: true */
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
      renderer = bid.Renderer,
      sc;

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
      renderer.render("#rp_info", "rp_info", {
        hostname: options.hostname,
        siteName: options.siteName,
        siteLogo: options.siteLogo,
        privacyPolicy: options.privacyPolicy,
        termsOfService: options.termsOfService
      });

      sc.start.call(this, options);
    }
  });

  sc = Module.sc;

  return Module;

}());

