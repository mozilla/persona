/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// utility functions for wsapi modules

const config = require('./configuration');

const FIREFOX_OS_DURATION = 315360000000; // 10 years

/**
 * Get info about how long the session should be and why
 *
 * @param {object} req      - the http request object
 *
 * Returns object with properties sessionDurationMS and
 * isFirefoxOSDuration.
 */
module.exports.getDurationInfo = function getDurationInfo(req) {
  req.params = req.params || {};
  req.headers = req.headers || {};

  const ephemeral = req.params.ephemeral;
  const ua_string = req.headers['user-agent'] || "";

  var result = {
    durationMS: ephemeral
              ? config.get('ephemeral_session_duration_ms')
              : config.get('authentication_duration_ms'),
    suppressAskIsUsersComputer: false
  };

  // FirefoxOS wants sessions to last for 10 years.
  //
  // (Kittens die when you match user agent strings.  So if you
  // like kittens, avert your eyes now.)
  //
  // Example ua: Mozilla/5.0 (Mobile; rv:18.0) Gecko/18.0 Firefox/18.0
  // Note: V8 compiles regexes automatically.
  if (ua_string.match(/Mobile.*Firefox/)) {
    result.durationMS = FIREFOX_OS_DURATION;
    result.suppressAskIsUsersComputer = true;
  }

  return result;
};

