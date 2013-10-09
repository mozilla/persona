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
  /^elapsed_time\.(.*)/
];

function getMatch(msg) {
  if (msg in TimingMessageMatches) return true;

  for (var i = 0, regExp; regExp = TimingRegExpMatches[i]; ++i) {
    if (regExp.test(msg)) return regExp;
  }
}

exports.test = function(msg) {
  return !!getMatch(msg);
};

exports.toType = function(msg) {
  var match = getMatch(msg);

  // Use the capturing part of the match for the message.
  if (match instanceof RegExp)
    msg = msg.match(match)[1];

  return PREFIX + msg;
};


