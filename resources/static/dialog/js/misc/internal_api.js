/*jshint browser: true, forin: true, laxbreak: true */
/*global BrowserID: true*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  "use strict";

  var nav = navigator,
      bid = BrowserID,
      internal = bid.internal = bid.internal || {},
      user = bid.User,
      storage = bid.Storage,
      moduleManager = bid.module;

  // given an object containing an assertion, extract the assertion string,
  // as the internal API is supposed to return a string assertion, not an
  // object.  issue #1395

  function assertionObjectToString(assertion) {
    if (assertion !== null && typeof assertion === 'object' && assertion.assertion) {
      assertion = assertion.assertion;
    }
    return assertion;
  }

  /**
   * Set the persistent flag to true for an origin.
   * @method setPersistent
   * @param {string} origin
   * @param {callback} [callback] - callback to call when complete.  Called
   * with true if successful, null if user is not authenticated or failure.
   */
  internal.setPersistent = function(origin, callback) {
    function complete(status) {
      callback && callback(status);
    }

    user.checkAuthentication(function onComplete(authenticated) {
      if (authenticated) {
        storage.site.set(origin, "remember", true);
      }

      complete(!!authenticated || null);
    }, complete.curry(null));
  };

  /**
   * Get an assertion.  Mimics the behavior of navigator.id.get.
   * options.silent defaults to false.  To get an assertion without using the
   * dialog, set options.silent to true.  To specify a required email, set
   * options.requiredEmail. By specifying both silent:true and requiredEmail:
   * <email>, an assertion will be attempted to be retreived for the given
   * email without showing the dialog.
   * @method get
   * @param {string} origin
   * @param {function} callback - called when complete.  Called with assertion
   * if success, null if the user cancels.  Other conditions causing null
   * return value: silent is true and user is not authenticated.  silent is
   * true, requiredEmail is specified but user does not control email.
   * @param {object} options.  See options block for navigator.id.get.
   * options.silent defaults to false.
   */
  internal.get = function(origin, callback, options) {
    function complete(assertion) {
      assertion = assertionObjectToString(assertion);
      // If no assertion, give no reason why there was a failure.
      callback && callback(assertion || null);
    }

    options = options || {};

    var silent = !!options.silent;
    if(silent) {
      // first, check the required email field, if that is not specified, go
      // check if an email is associated with this site. If that is not
      // available, there is not enough information to continue.
      var requiredEmail = options.requiredEmail || storage.site.get(origin, "email");
      if(requiredEmail) {
        getSilent(origin, requiredEmail, callback);
      }
      else {
        complete();
      }
    }
    else {
      // Use the standard dialog facilities to get the assertion, pass the
      // options block directly to the dialog.
      var controller = moduleManager.getRunningModule("dialog");
      if(controller) {
        controller.get(origin, options, complete, complete);
      }
      else {
        complete();
      }
    }
  };

  /*
   * Get an assertion without user interaction - internal use
   */
  function getSilent(origin, email, callback) {
    function complete(assertion) {
      assertion = assertionObjectToString(assertion);
      callback && callback(assertion || null);
    }

    user.checkAuthenticationAndSync(function(authenticated) {
      // User must be authenticated to get an assertion.
      if(authenticated) {
        user.setOrigin(origin);
        user.getAssertion(email, user.getOrigin(), function(assertion) {
          complete(assertion || null);
        }, complete.curry(null));
      }
      else {
        complete(null);
      }
    }, complete.curry(null));
  }

}());
