/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.Models.NetworkContext = (function() {
  "use strict";
  /**
   * This model represents Session Context. It contains basic info
   * needed to communicate with the backend.
   */

  var bid = BrowserID,
      und,
      sc;

  var Module = bid.Modules.Module.extend({
    csrf_token: und,
    local_time: und,
    domain_key_creation_time: und,
    code_version: und,
    cookies: und,
    random_seed: und,

    init: function(options) {
      var self = this;

      self.setContext(options);

      sc.init.call(self, options);
    },

    setContext: function(context) {
      this.importFrom(context,
        'csrf_token',
        'server_time',
        'domain_key_creation_time',
        'code_version',
        'cookies',
        'random_seed'
        );

      this.local_time = new Date().getTime();

      if (context.forceCookiesEnabled) {
        this.cookies = context.forceCookiesEnabled;
      }
    },

    getCsrfToken: function() {
      return this.csrf_token;
    },

    getLocalTime: function() {
      if (!this.local_time) throw new Error("can't get local time!");

      return this.local_time;
    },

    getServerTime: function() {
      if (!this.server_time) throw new Error("can't get server time!");

      var offset = (new Date()).getTime() - this.getLocalTime();
      return new Date(offset + this.server_time);
    },

    getDomainKeyCreationTime: function() {
      if (!this.domain_key_creation_time) throw new Error("can't get domain key creation time!");

      return new Date(this.domain_key_creation_time);
    },

    getCodeVersion: function() {
      return this.code_version;
    },

    areCookiesEnabled: function() {
      return !!this.cookies;
    },

    getRandomSeed: function() {
      return this.random_seed;
    }
  });

  sc = Module.sc;

  return Module;
}());

