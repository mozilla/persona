/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Models.RpInfo = (function() {
  "use strict";

  /**
   * This model represents RP specific info. This is created on startup, only
   * origin and hostname are required.
   */

  var bid = BrowserID,
      und,
      sc;

  var Module = bid.Modules.Module.extend({
    origin: und,
    hostname: und,
    backgroundColor: und,
    siteName: und,
    siteLogo: und,
    privacyPolicy: und,
    termsOfService: und,
    allowUnverified: und,

    init: function(options) {
      var self = this;

      self.importFrom(options,
        'origin',
        'hostname',
        'backgroundColor',
        'siteName',
        'siteLogo',
        'privacyPolicy',
        'termsOfService',
        'allowUnverified'
        );

      sc.init.call(self, options);
    },

    getOrigin: function() {
      return this.origin;
    },

    getHostname: function() {
      return this.hostname;
    },

    getBackgroundColor: function() {
      return this.backgroundColor;
    },

    getSiteName: function() {
      return this.siteName;
    },

    getSiteLogo: function() {
      return this.siteLogo;
    },

    getTermsOfService: function() {
      return this.termsOfService;
    },

    getAllowUnverified: function() {
      return this.allowUnverified;
    }
  });

  sc = Module.sc;

  return Module;
}());

