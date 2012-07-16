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

const emailRegex = /\@(.*)$/;

exports.process = function(req, res) {
  // parse out the domain from the email
  var m = emailRegex.exec(req.params.email);

  // Saftey value for production branch only
  // (lth) ^^ what does this mean? ^^
  var done = false;
  primary.checkSupport(m[1], function(err, urls, publicKey, delegates) {
    if (done) {
      return;
    }
    done = true;
    if (err) {
      logger.info('"' + m[1] + '" primary support is misconfigured, falling back to secondary: ' + err);
      // primary check failed, fall back to secondary email verification
    }

    if (urls) {
      urls.type = 'primary';
      res.json(urls);
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
