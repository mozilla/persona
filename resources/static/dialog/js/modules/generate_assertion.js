/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Modules.GenerateAssertion = (function() {
  "use strict";

  /**
   * This module takes care of generating an assertion. When it is complete, it
   * triggers the "assertion_generated" message with the assertion. If an
   * assertion was unable to be created, a null assertion will be passed.
   */

  var bid = BrowserID,
      complete = bid.Helpers.complete,
      user = bid.User,
      storage = bid.Storage,
      errors = bid.Errors,
      sc;

  var GenerateAssertion = bid.Modules.PageModule.extend({
    start: function(options) {
      options = options || {};

      var self = this;

      self.checkRequired(options, "email", "rpInfo");

      var email = options.email,
          origin = options.rpInfo.getOrigin();

      user.getAssertion(email, origin, function(assertion) {
        assertion = assertion || null;

        if (assertion) {
          storage.site.set(origin, "logged_in", email);
        }

        self.publish("assertion_generated", {
          assertion: assertion
        });

        complete(options.ready);
      }, self.getErrorDialog(errors.getAssertion, options.ready));

      sc.start.call(self, options);
    }
  });

  sc = GenerateAssertion.sc;

  return GenerateAssertion;

}());

