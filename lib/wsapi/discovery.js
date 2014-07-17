/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
config = require('../configuration.js'),
logger = require('../logging/logging.js').logger,
primary = require('../primary.js'),
secrets = require("../secrets.js"),
urlparse = require('urlparse');

// Firefox Desktop will use this wsapi for discovery (feature preffed off)

exports.method = 'get';
exports.writes_db = false;
exports.authed = false;
exports.args = {
  'domain': 'hostname'
};
exports.i18n = false;


// determine public hostname for use as the issuer for
// secondary addresses
const HOSTNAME = urlparse(config.get('public_url')).host;

try {
  const fallbackPubKey = secrets.loadPublicKey();
} catch(e){
  logger.error("can't read public key, exiting: " + e);
  process.nextTick(function() { process.exit(1); });
}

exports.process = function(req, res) {
  var domain = req.params.domain;
  var wellKnown;
  primary.checkSupport(domain, function(err, r) {
    if (!err && r && r.urls) {
      wellKnown = {
        "public-key": JSON.parse(r.publicKey.serialize()), // gross
        authentication: r.urls.auth,
        provisioning: r.urls.prov,
      };
    } else {
      if (err) {
        logger.info('"' + domain + '" primary support is misconfigured, falling back to secondary: ' + err);
      }
      wellKnown = {
        "public-key": fallbackPubKey.toSimpleObject(),
        authentication: config.get('public_url') + '/auth#NATIVE',
        provisioning: config.get('public_url') + '/provision'
      };
    }
    res.json(wellKnown);
  });
};
