/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const config = require('../../../configuration');
const PREFIX = "browserid." + config.get('process_type') + ".";

var TimingMessageMatches = {
  "bcrypt.compare_time": true,
  "query_time": true,
  "certification_time": true,
  "assertion_verification_time": true
};

var TimingRegExpMatches = [
];

exports.test = function(msg) {
  if (msg in TimingMessageMatches) return true;

  for (var i = 0, regExp; regExp = TimingRegExpMatches[i]; ++i) {
    if (regExp.test(msg)) return true;
  }

  return false;
};

exports.toType = function(msg) {
  return PREFIX + msg;
};


