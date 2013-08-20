/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
logger = require('../logging.js').logger,
primary = require('../primary.js');

// Callback has the signature `function (type) {}`
exports.withType = function(email, cb) {
  var domain = email.replace(/[^@]*@/, '');
  primary.checkSupport(domain, function (err, urls) {
    var type = 'secondary';
    if (err) {
      logger.info('"' + domain + '" primary support is misconfigured, falling back to secondary: ' + err);
      // primary check failed, fall back to secondary email verification
    } else if (urls) {
      type = 'primary';
    }
    cb(type);
  });
};
