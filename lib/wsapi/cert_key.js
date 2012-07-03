/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
httputils = require('../httputils'),
logger = require('../logging.js').logger,
forward = require('../http_forward.js').forward,
config = require('../configuration.js'),
urlparse = require('urlparse'),
wsapi = require('../wsapi.js');

exports.method = 'post';
exports.writes_db = false;
exports.authed = 'password';
exports.args = ['email','pubkey','ephemeral'];
exports.i18n = false;

exports.process = function(req, res) {
  db.userOwnsEmail(req.session.userid, req.body.email, function(err, owned) {
    if (err) return wsapi.databaseDown(res, err);

      // not same account? big fat error
      if (!owned) return httputils.badRequest(res, "that email does not belong to you");

    // secondary addresses in the database may be "unverified".  this occurs when
    // a user forgets their password.  We will not issue certs for unverified email
    // addresses
    db.emailIsVerified(req.body.email, function(err, verified) {
      if (!verified) return httputils.forbidden(res, "that email requires (re)verification");

      // forward to the keysigner!
      var keysigner = urlparse(config.get('keysigner_url'));
      keysigner.path = '/wsapi/cert_key';
      forward(keysigner, req, res, function(err) {
        if (err) {
          logger.error("error forwarding request to keysigner: " + err);
          httputils.serverError(res, "can't contact keysigner");
          return;
        }
      });
    });
  });
};
