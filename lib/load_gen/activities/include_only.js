/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* this file is the "include_only" activity, which simulates the load
 * of an RP including include.js. */

var client = require('../../wsapi_client.js');

exports.startFunc = function(cfg, cb) {
  client.get(cfg, '/include.js', {}, undefined, function(err, r) {
    if (err) {
      cb(err);
    } else if (!r || r.code !== 200) {
      cb("for include.js fetch response code is not 200: " + (r ? r.code : "no response"));
    } else {
      // XXX: check the checksum of body?
      cb();
    }
  });
};
