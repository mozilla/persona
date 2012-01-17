/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
httputils = require('../httputils'),
logger = require('../logging.js').logger,
forward = require('../http_forward.js'),
config = require('../configuration.js');

exports.method = 'post';
exports.writes_db = false;
exports.authed = 'password';
exports.args = ['email','pubkey'];

exports.process = function(req, res) {
  db.userOwnsEmail(req.session.userid, req.body.email, function(owned) {
    // not same account? big fat error
    if (!owned) return httputils.badRequest(res, "that email does not belong to you");

    // forward to the keysigner!
    var keysigner = config.get('keysigner_url');
    keysigner.path = '/wsapi/cert_key';
    forward(keysigner, req, res, function(err) {
      if (err) {
        logger.error("error forwarding request: " + err);
        res.sendHeader(500);
        res.json({ "error": "can't contact keysigner" });
        return;
      }
    });
  });
};
