/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* This little module will, when included, hook the email verification system
 * and instead of sending emails will make verification tokens available
 * via the WSAPI.  This is *highly* insecure and should only be used when
 * testing (performance or otherwise).
 */

const
configuration = require('../configuration.js'),
url = require('url'),
db = require('../db.js'),
logger = require('../logging.js').logger,
wsapi = require('../wsapi');

logger.warn("HEAR YE: Fake verfication enabled, aceess via /wsapi/fake_verification?email=foo@bar.com");
logger.warn("THIS IS NEVER OK IN A PRODUCTION ENVIRONMENT");

exports.addVerificationWSAPI = function(app) {
  app.get('/wsapi/fake_verification', function(req, res) {
    var email = url.parse(req.url, true).query['email'];
    db.verificationSecretForEmail(email, function(err, secret) {
      if (err) return wsapi.databaseDown(res, err);
      if (secret) res.write(secret);
      else res.writeHead(400, {"Content-Type": "text/plain"});
      res.end();
    });
  });
};
