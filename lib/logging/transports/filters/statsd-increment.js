/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const config = require('../../../configuration');
const PREFIX = "browserid." + config.get('process_type') + ".";


var IncrementMessageMatches = {
  "assertion_failure": true,
  "uncaught_exception": true
};

var IncrementRegExpMatches = [
  /^wsapi_code_mismatch\./,
  /^wsapi\./
];

exports.test = function(msg) {
  if (msg in IncrementMessageMatches) return true;

  for (var i = 0, regExp; regExp = IncrementRegExpMatches[i]; ++i) {
    if (regExp.test(msg)) return true;
  }

  return false;
};

exports.toType = function(msg) {
  return PREFIX + msg;
};


