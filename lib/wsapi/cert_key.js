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
exports.args = {
  'email': 'email',
  'pubkey': 'pubkey',
  'ephemeral': 'boolean',
  'forceIssuer': {
    type: 'hostname',
    required: false
  },
  'allowUnverified': {
    type: 'boolean',
    required: false
  }
};
exports.i18n = false;

exports.process = function(req, res) {
  db.userOwnsEmail(req.session.userid, req.params.email, req.params.allowUnverified, function(err, owned) {
    if (err) return wsapi.databaseDown(res, err);

    // not same account? big fat error
    if (!owned) return httputils.badRequest(res, "that email does not belong to you");

    function forwardToKeysigner(unverified) {
      // forward to the keysigner!
      var keysigner = urlparse(config.get('keysigner_url'));
      keysigner.path = '/wsapi/cert_key';

      // parameter validation moves arguments from req.body to req.params,
      // and removes them from req.body.  This feature makes it impossible
      // to use unvalidated params in your wsapi "process" function.
      //
      // http_forward, however, will only forward params in req.body
      // or req.query.  so we explicitly copy req.params to req.body
      // to cause them to be forwarded.
      var body = {
        'email': req.params.email,
        'pubkey': req.params.pubkey,
        'ephemeral': req.params.ephemeral,
        'unverified': unverified
      };
      req.body = body;

      forward(keysigner, req, res, function(err) {
        if (err) {
          logger.error("error forwarding request to keysigner: " + err);
          httputils.serverError(res, "can't contact keysigner");
          return;
        }
      });

      // Now record how this email was last used.  Note, we do this in
      // parallel to key-signing.  The user has already seen the transition
      // language, even if keysigning fails, let's turn that screen off.
      //
      // XXX: we should consider moving this whole request handler over to
      // the dbwriter to simplify the code and reduce it's cost.  Only reason
      // this is not done is because we currently have no traffic from
      // dbwriter to keysigner.
      wsapi.requestToDBWriter({
        path: '/wsapi/user_used_email_as',
        method: "POST",
        headers: {
          'Cookie': req.headers.cookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: req.params.email,
          used_as: 'secondary',
          csrf: req.session.csrf
        })
      }, function(err) {
        if (err) logger.warn("couldn't update lastUsedAs: " + err);
      });
    }

    // secondary addresses in the database may be "unverified".  this occurs when
    // a user forgets their password.  We will not issue certs for unverified email
    // addresses
    // ... unless allowUnverified is true
    db.emailIsVerified(req.params.email, function(err, verified) {
      if (!verified && !req.params.allowUnverified) return httputils.forbidden(res, "that email requires (re)verification");
    });
  });
};
