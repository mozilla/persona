/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
primary = require('../primary.js'),
wsapi = require('../wsapi.js'),
httputils = require('../httputils.js'),
Q = require('q'),
url = require('url'),
urlparse = require('urlparse'),
logger = require('../logging/logging.js').logger,
config = require('../configuration.js');

const DEFAULT_ISSUER = 'default';

// type: {primary, secondary} // indicates email type right now
// state: {string}
//   "known": the email address is known
//   "unknown": the email is not known to us
//   "transition_to_primary": the primary email address was last used as a secondary, the user will be authenticating via idp for the first time
//   "transition_to_secondary": the secondary email address was last used as a primary, the user has a password and can authenticate with it.
//   "transition_no_password": the secondary email address was last used as a primary address, the user has no password and must select one.
//   "unverified": ...
//   "offline": the primary authority is offline and the user cannot authenticate with this email right now.
// auth: <string> // (primary only) authentication URL
// prov: <string> // (primary only) certificate provisioning URL


// a table which can be used to determine state.  This table is only meaningful
// when a) the email is known and b) the primary is not "broken" right now
// passwordKnown -> lastUsedAs -> right now
const STATE_TABLE = {
  true: {
    "primary": {
      "primary": "known",
      "secondary": "transition_to_secondary"
    },
    "secondary": {
      "primary": "transition_to_primary",
      "secondary": "known"
    }
  },
  false: {
    "primary": {
      "primary": "known",
      "secondary": "transition_no_password"
    },
    "secondary": {
      "primary": "transition_to_primary",
      "secondary": "transition_no_password"
    }
  }
};

exports.method = 'get';
exports.writes_db = false;
exports.authed = false;
exports.args = {
  'email': 'email',
  'issuer': {
    type: 'hostname',
    required: false
  }
};
exports.i18n = false;

// determine public hostname for use as the issuer for
// secondary addresses
const HOSTNAME = urlparse(config.get('public_url')).host;

exports.process = function(req, res) {

  function forgetIDP(domain) {
    wsapi.requestToDBWriter({
      path: '/wsapi/forget_idp?domain=' + encodeURIComponent(domain)
    }, function(err) {
      if (err) logger.warn("failed to forget IDP for domain " + domain + ": " + err);
    });
  }

  // parse out the domain from the email
  var domain = primary.domainFromEmail(req.params.email);

  // to determine the state of this email, we need the following information:
  // * emailKnown: is this in the database
  // * normalizedEmail = what is the proper canonical form of the email
  // * hasPassword: does this email have a password?
  // * lastUsedAs: when last used, what type of address was this?
  // * primarySeenRecently: was the domain a primary IdP in the last 30 days?
  // * stateRightNow: is the domain a secondary or primary domain right now?
  // * unverified: is this a secondary email that requires re-verification upon use?

  var primarySupport;
  var issuer = req.params.issuer || DEFAULT_ISSUER;
  var isDefaultIssuer = issuer === DEFAULT_ISSUER;
  if (isDefaultIssuer) {
    primarySupport = primary.currentSupport(domain);
  } else {
    primarySupport = Q.resolve({
      type:'secondary',
      issuer: issuer,
      disabled: false
    });
  }

  var emailInfo = Q.nfcall(db.emailInfo, req.params.email);

  Q.spread([primarySupport, emailInfo], function(support, info) {

    var seen = support.seen;
    delete support.seen;

    var r = support;

    if (info && info.normalizedEmail) r.normalizedEmail = info.normalizedEmail;
    var emailKnown = !!info;
    var hasPassword = info && info.hasPassword;
    var unverified = info && !info.verified;
    var lastUsedAs = info && info.lastUsedAs;
    if (!isDefaultIssuer) lastUsedAs = 'secondary';

    if (!emailKnown) {
      r.state = "unknown";
    } else if (!isDefaultIssuer && hasPassword) {
      // If the issuer is forced and the user already has a password, treat the
      // address as a known secondary.
      r.state = "known";
    } else if (!isDefaultIssuer && ! hasPassword) {
      // If the issuer is forced and the user does not have a password, treat
      // the address as a primary that has converted to a secondary and force
      // the user to add a password to their account.
      r.state = "transition_no_password";
    } else if (support.offline) {
      r.state = "offline";
    } else if (r.type === 'secondary' && unverified) {
      r.state = "unverified";
    } else {
      r.state = STATE_TABLE[hasPassword][lastUsedAs][support.type];
    }
    res.json(r);

    if (seen) forgetIDP(domain);

  }, function(err) {
    // assume that this error was due to the database being down.
    // returning a 503 code shows the user an "overloaded" message,
    // which is generally what we want.
    wsapi.databaseDown(res, String(err));
  }).done();
};
