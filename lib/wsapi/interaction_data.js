/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const coarse = require('../coarse_user_agent_parser'),
      logger = require('../logging/logging').logger,
      und = require('underscore'),
      kpi_data = require('../kpi_data');

// Accept JSON formatted interaction data and send it to the KPI Backend

// WSAPI provides CSRF protection
// TODO size limit is currently 10kb from bin/browserid, may need to expand this

exports.method = 'post';
exports.writes_db = false;
exports.authed = false;
exports.i18n = false;


exports.process = function(req, res) {
  // Always send a quick success response.  The client won't know if
  // the interaction_data blob successfully made it into the backend,
  // but because this is non-critical data, it's not worth leaving
  // the connection open and reporting this information for now.
  res.json({ success: true });

  if (req.body.data) {
    var kpi_json = req.body.data;

    if (req.headers['user-agent']) {
      var ua = coarse.parse(req.headers['user-agent']);
      und.each(kpi_json, function (kpi) {
        if (! kpi.user_agent) {
          kpi.user_agent = {};
        }
        und.extend(kpi.user_agent, ua);
      });
    }

    logger.debug("Simulate write to KPI Backend DB - " + JSON.stringify(kpi_json, null, 2));
    kpi_data.store(kpi_json, function (err, store_success) {
      if (err) return logger.warn(String(err));
      if (!store_success) logger.warn("failed to store interaction data");
    });
  } else {
    logger.info("failed to store interaction data, client sent no .data");
  }
};
