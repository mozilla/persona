/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
primary = require('../primary.js'),
wsapi = require('../wsapi.js'),
httputils = require('../httputils.js'),
url = require('url'),
logger = require('../logging.js').logger;

// return information about an email address.
//   type:  is this an address with 'primary' or 'secondary' support?
//   if type is 'secondary':
//     known: is this address known to browserid?
//   if type is 'primary':
//     auth: what is the url to send the user to for authentication
//     prov: what is the url to embed for silent certificate (re)provisioning

exports.method = 'get';
exports.writes_db = false;
exports.authed = false;
exports.args = {
  'email': 'email'
};
exports.i18n = false;

exports.process = function(req, res) {
  var m = primary.emailRegex.exec(req.params.email);
  primary.checkSupport(m[1], function(err, r) {
    if (err) {
      logger.info('"' + m[1] + '" primary support is misconfigured, falling back to secondary: ' + err);
      // primary check failed, fall back to secondary email verification
    }

    if (r && r.urls) {
      r.urls.type = 'primary';
      res.json(r.urls);
    } else {
      db.emailKnown(req.params.email, function(err, known) {
        if (err) {
          return wsapi.databaseDown(res, err);
        } else {
          res.json({ type: 'secondary', known: known });
        }
      });
    }
  });
};
