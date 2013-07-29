/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
httputils = require('../httputils'),
logger = require('../logging.js').logger,
primary = require('../primary.js'),
wsapi = require('../wsapi.js');

// Updates DB state regarding how the user has last used an email
// Needed for when an email address goes from Secondary to Primary.
// If an email address goes from Primary to Secondary, the update
// to the db is made in the cert_key wsapi call.
// used_address_as_primary wsapi exists, only because there is no good
// API call to piggyback on. If we ever add another POST, we can
// push this behavior into that new wsapi.

exports.method = 'post';
exports.writes_db = true;
exports.authed = 'assertion';
exports.args = {
  'email': 'email'
};
exports.i18n = false;

exports.process = function (req, res) {
  var email = req.params.email;
  db.userOwnsEmail(req.session.userid, email, function(err, owned) {
    if (err) return wsapi.databaseDown(res, err);
    // not same account? big fat error
    if (!owned) return httputils.badRequest(res, "that email does not belong to you");
    var domain = primary.domainFromEmail(email);
        
    primary.checkSupport(domain, function (err, r) {
      var notPrimary = false;
      if (err) {
        logger.error('"' + domain + '" primary support is misconfigured, falling back to secondary: ' + err);
        notPrimary = true;
      } else if (r && r.urls) {
        db.updateEmailLastUsedAs(email, 'primary', function (err) {
          if (err) return httputils.serverError(res, "Unable to update database");
          return res.json({success: true});
        });
      } else {
        notPrimary = true;
      }
      if (notPrimary) return httputils.badRequest(res, "email is not a primary");
    });
  });
};
