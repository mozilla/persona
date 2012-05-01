/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
logger = require('../logging.js').logger,
wsapi = require('../wsapi.js');

// Accept JSON formatted interaction data and send it to the KPI Backend

exports.method = 'post';
exports.writes_db = false;
exports.authed = false;
exports.i18n = false;

logger.debug("interaction_data wsapi init");

exports.process = function(req, res) {
  logger.debug("interaction_data processing request");
  function sendResponse() {
    var respObj = {
      success: true // TODO is there a stanard for this property in our code?
    };
    res.json(respObj);
  };
  sendResponse();
};
