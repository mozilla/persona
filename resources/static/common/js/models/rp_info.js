/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Models.RpInfo = (function() {
  "use strict";

  /**
   * This model represents RP specific info, most of which is passed by the RP.
   * An RpInfo model is created on startup.
   *
   * Note: a major assumption is made that all RP provided parameters passed
   * to this object are already checked for validity and properly escaped.
   * This should be done in dialog/js/modules/dialog.js and
   * dialog/js/modules/validate_rp_params.js
   *
   * origin is required and comes from a trusted sources (WinChan or native
   * hooks)
   */

  var bid = BrowserID,
      und,
      sc;

  var Module = bid.Modules.Module.extend({
    origin: und,
    backgroundColor: und,
    siteName: und,
    siteLogo: und,
    privacyPolicy: und,
    termsOfService: und,
    allowUnverified: false,
    returnTo: und,
    issuer: 'default',
    emailHint: und,
    userAssertedClaims: und,
    rpAPI: und,

    init: function(options) {
      var self = this;

      self.checkRequired(options, 'origin');

      self.importFrom(options,
        'origin',
        'backgroundColor',
        'siteName',
        'siteLogo',
        'privacyPolicy',
        'termsOfService',
        'allowUnverified',
        'returnTo',
        'rpAPI',
        'emailHint',
        'userAssertedClaims'
        );

      if (options.forceIssuer) self.issuer = options.forceIssuer;

      sc.init.call(self, options);
    },

    getOrigin: function() {
      return this.origin;
    },

    getHostname: function() {
      return this.origin && this.origin.replace(/^.*:\/\//, "").replace(/:\d*$/, "");
    },

    getBackgroundColor: function() {
      return this.backgroundColor;
    },

    getSiteName: function() {
      return this.siteName || this.getHostname();
    },

    getSiteLogo: function() {
      return this.siteLogo;
    },

    getEmailableSiteLogo: function() {
      // data URI siteLogos are not universally mailable.
      if (/^https:/.test(this.siteLogo)) {
        return this.siteLogo;
      }
    },

    getPrivacyPolicy: function() {
      return this.privacyPolicy;
    },

    getTermsOfService: function() {
      return this.termsOfService;
    },

    getAllowUnverified: function() {
      return this.allowUnverified;
    },

    getReturnTo: function() {
      return this.returnTo;
    },

    getIssuer: function() {
      return this.issuer;
    },

    isDefaultIssuer: function() {
      return this.issuer === "default";
    },

    getRpAPI: function() {
      return this.rpAPI;
    },

    getEmailHint: function() {
      return this.emailHint;
    },

    getUserAssertedClaims: function() {
      return this.userAssertedClaims;
    }
  });

  sc = Module.sc;

  return Module;
}());

