/*jshint browsers:true, forin: true, laxbreak: true */
/*global BrowserID: true*/
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla BrowserID.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

(function() {
  "use strict";

  var nav = navigator,
      bid = BrowserID,
      internal = bid.internal = bid.internal || {},
      user = bid.User,
      storage = bid.Storage,
      moduleManager = bid.module;

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
      if(authenticated) {
        storage.site.set(origin, "remember", true);
      }

      complete(authenticated || null);
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
      callback && callback(assertion);
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
