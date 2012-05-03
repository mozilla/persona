/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const config = require('../configuration.js'),
      http = require('http'),
      logger = require('../logging.js').logger,
      wsapi = require('../wsapi.js');

// Accept JSON formatted interaction data and send it to the KPI Backend

// WSAPI provides CSRF protection
// TODO size limit is currently 10kb from bin/browserid, may need to expand this

exports.method = 'post';
exports.writes_db = false;
exports.authed = false;
exports.i18n = false;

logger.debug("interaction_data wsapi init");

var store = function (kpi_json, cb) {
  var options,
      kpi_req,
      kpi_resp = function (res) {
        logger.debug('KPI Backend responded ' + res.statusCode);
      };
  if (!! config.get('kpi_backend_db_hostname') &&
      !! config.get('kpi_backend_db_port')) {

    options = {
          hostname: config.get('kpi_backend_db_hostname'),
          port: config.get('kpi_backend_db_port'),
          method: 'POST'
    };

    kpi_req = http.request(options);
    kpi_req.on('error', function (e) {
      // TODO statsd counter
      logger.error('KPI Backend request error: ' + e.message);
    });
    logger.debug("sending request to KPI backend" + config.get('kpi_backend_db_hostname'));
    kpi_req.end();
  } else {
    cb(false);
  }
};

exports.process = function(req, res) {
  // Always send a quick success response.  The client won't know if
  // the interaction_data blob successfully made it into the backend,
  // but because this is non-critical data, it's not worth leaving
  // the connection open and reporting this information for now.
  res.json({ success: true });

  logger.debug("interaction_data processing request");

  if (req.body.data) {
    var kpi_json = req.body.data;
    logger.debug("Simulate write to KPI Backend DB - " + JSON.stringify(kpi_json, null, 2));
    try {
      store(kpi_json, function (store_success) {
        if (!store_success) {
          logger.warn("failed to store interaction data");
        }
      });
    } catch (e) {
      // TODO ignore silently or set statsd counter
      logger.warn("failed to store interaction data, JSON error: " +
                  e.toString());
    }
  } else {
    logger.info("failed to store interaction data, client sent no .data");
  }
};
