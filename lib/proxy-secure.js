/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const config = require('./configuration');

const OVER_SSL = config.get('scheme') === 'https';

// we set this parameter so that hood.hsts() and clientSessions()
// can work even though the local connection is HTTP
// (the load balancer does SSL)
module.exports = function proxySecureFactory() {
  return OVER_SSL ? function proxySecure(req, res, next) {
    req.connection.proxySecure = true;
    next();
  } : function proxyNotSecure(req, res, next) {
    next();
  };
};
