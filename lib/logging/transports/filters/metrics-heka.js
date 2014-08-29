/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * message filter for metrics messages.
 *
 * Messages cared about:
 * signin
 * verify
 * stage_email.success
 * stage_reset.success
 * stage_reverify.success
 * stage_transition.success
 * stage_user.success
 * complete_email_confirmation.success
 * complete_reset.success
 * complete_transition.success
 * complete_user_creation.success
 * idp.auth_return
 * idp.auth_cancel
 * idp.create_new_user
*/

const _ = require('underscore');
const os = require('os');
const TEN_MIN_IN_MS = 10 * 60 * 1000;

const PID = process.pid;
const HOSTNAME = os.hostname();
const SYSLOG_SEVERITY = 6;  // syslog severity of info

const KPI_WHITELIST = [
  'agent',
  'idp',
  'lang',
  'new_account',
  'number_emails',
  'number_sites_signed_in',
  'number_sites_remembered',
  'rp',
  'rp_api',
  'sample_rate'
];

const MessageMatches = {
  signin: true,
  verify: true,
  kpi: true
};

const RegExpMatches = [
  /complete_(?:[^\.]+)\.success/,
  /stage_(?:[^\.]+)\.success/,
  /^metrics\.report\./,
  /^idp\.auth_.*/,
  /^idp\.create_new_user/
];

exports.test = function (msg) {
  if (msg in MessageMatches) return true;

  for (var i = 0, regExp; regExp = RegExpMatches[i]; ++i) {
    if (regExp.test(msg)) return true;
  }

  return false;
};

exports.toType = function (msg) {
  return 'persona.' + msg.replace(/^metrics\.report\./, '');
};

exports.toEntry = function (msg, entry) {
  // create a copy of the entry so that changing fields does not have
  // side effects elsewhere.
  if (typeof entry === 'object') entry = _.extend({}, entry);

  // allow convenient reporting of atoms by converting atoms into objects
  if (entry === null || typeof entry !== 'object') entry = { msg: entry };
  if (entry.type)
    throw "reported metrics may not have a `type` property, that's reserved";

  // For format, see
  // https://mana.mozilla.org/wiki/display/CLOUDSERVICES/Logging+Standard
  var dataToLog = {
    EnvVersion: 1,
    Hostname: HOSTNAME,
    Pid: PID,
    Severity: SYSLOG_SEVERITY,
    Timestamp: getRoundedTimestamp(entry.timestamp),
    Type: exports.toType(msg)
  };

  KPI_WHITELIST.forEach(function (fieldName) {
    if (fieldName in entry) {
      dataToLog[fieldName] = entry[fieldName];
    }
  });

  if (entry.screen_size) {
    dataToLog.screen_width = entry.screen_size.width;
    dataToLog.screen_height = entry.screen_size.height;
  }

  if (entry.event_stream) {
    // ditch the extra timing info on the event.
    dataToLog.event_stream = _.map(entry.event_stream, function(event) {
      return event[0];
    });
  }

  return dataToLog;
};


function getRoundedTimestamp(timestamp) {
  // Out of concern for the user's privacy, round the server timestamp
  // off to the nearest 10-minute mark.
  timestamp = timestamp || Date.now();
  return timestamp - (timestamp % TEN_MIN_IN_MS);
}


