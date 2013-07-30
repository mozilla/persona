/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
primary = require('../primary.js'),
wsapi = require('../wsapi.js'),
httputils = require('../httputils.js'),
url = require('url'),
urlparse = require('urlparse'),
logger = require('../logging.js').logger,
config = require('../configuration.js');

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
  var emailKnown = false;
  // * normalizedEmail = what is the proper canonical form of the email
  var normalizedEmail;
  // * hasPassword: does this email have a password?
  var hasPassword;
  // * lastUsedAs: when last used, what type of address was this?
  var lastUsedAs;
  // * primarySeenRecently: was the domain a primary IdP in the last 30 days?
  var primarySeenRecently;
  // * stateRightNow: is the domain a secondary or primary domain right now?
  var typeRightNow;
  // * unverified: is this a secondary email that requires re-verification upon use?
  var unverified;
  // * asyncError: was there an error while trying to answer the above questions?
  var asyncError;


  // first, we answer all of these questions in parallel.
  // NOTE: using a library would improve this code.
  var questionsToAnswer = 3;

  // first question: figure out the state of the domain right now
  var issuer = req.params.issuer || 'default';
  if ('default' !== issuer) {
    questionsToAnswer--;
    typeRightNow = {
      type:'secondary',
      issuer: issuer,
      disabled: false
    };
    questionAnswered();
  } else {
    primary.checkSupport(domain, function(err, r) {
      questionsToAnswer--;

      if (!err && r && r.urls) {
        typeRightNow = r.urls;
        typeRightNow.type = 'primary';
        typeRightNow.issuer = r.authoritativeDomain;
      } else {
        if (err) {
          logger.info('"' + domain + '" primary support is misconfigured, falling back to secondary: ' + err);
        }
        typeRightNow = {
          type:'secondary',
          issuer: HOSTNAME,
          disabled: (r && r.disabled) || false
        };
      }

      questionAnswered();
    });
  }

  if ('default' !== issuer) {
    // skip second question primarySeenRecently
    questionsToAnswer--;
  } else {
    // second question: figure out whether the primary was recently seen
    db.getIDPLastSeen(domain, function(err, when) {
      questionsToAnswer--;

      // if the database is broke, then return an error
      if (err) {
        if (!asyncError) asyncError = err;
      } else {
        if (when) {
          if ((new Date() - when) < config.get('idp_offline_grace_period_ms')) {
            primarySeenRecently = true;
          } else {
            // we did see this idp, but it was a while ago.  let's lazy cleanup
            // the database
            forgetIDP(domain);
          }
        }
      }
      questionAnswered();
    });
  }

  // third question: get information about the email address
  db.emailInfo(req.params.email, function(err, info) {
    questionsToAnswer--;

    if (err) {
      if (!asyncError) asyncError = err;
    } else {
      emailKnown = !!info;
      hasPassword = info ? info.hasPassword : false;
      lastUsedAs = info ? info.lastUsedAs : null;
      unverified = info ? !info.verified : undefined;
      normalizedEmail = info ? info.normalizedEmail : undefined;
    }
    // Force Issuer - ignore primary
    if ('default' !== issuer) lastUsedAs = 'secondary';
    questionAnswered();
  });

  function questionAnswered() {

    if (questionsToAnswer > 0) return;
    if (asyncError) {
      // assume that this error was due to the database being down.
      // returning a 503 code shows the user an "overloaded" message,
      // which is generally what we want.
      return wsapi.databaseDown(res, asyncError.toString());
    }

    // now we have all the information we need, let's generate
    // a response
    var r = typeRightNow;

    if (normalizedEmail) r.normalizedEmail = normalizedEmail;

    if (!emailKnown) {
      r.state = "unknown";
    } else if ('default' !== issuer && hasPassword) {
      // If the issuer is forced and the user already has a password, treat the
      // address as a known secondary.
      r.state = "known";
    } else if ('default' !== issuer && ! hasPassword) {
      // If the issuer is forced and the user does not have a password, treat
      // the address as a primary that has converted to a secondary and force
      // the user to add a password to their account.
      r.state = "transition_no_password";
    } else if (r.type === 'secondary' && primarySeenRecently && !r.disabled) {
      r.state = "offline";
    } else if (r.type === 'secondary' && unverified) {
      r.state = "unverified";
    } else {
      r.state = STATE_TABLE[hasPassword][lastUsedAs][typeRightNow.type];
    }
    res.json(r);

    // if primaries are explicitly disabled and have been seen recently,
    // let's forget about this IdP.
    if (primarySeenRecently && r.disabled) forgetIDP(domain);

  }
};
