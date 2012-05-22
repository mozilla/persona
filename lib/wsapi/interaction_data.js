/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const coarse = require('../coarse_user_agent_parser'),
      config = require('../configuration.js'),
      http = require('http'),
      logger = require('../logging.js').logger,
      querystring = require('querystring'),
      und = require('underscore'),
      urlparse = require('urlparse'),
      wsapi = require('../wsapi.js'),
      TEN_MIN_IN_MS = 10 * 60 * 1000;

// Accept JSON formatted interaction data and send it to the KPI Backend

// WSAPI provides CSRF protection
// TODO size limit is currently 10kb from bin/browserid, may need to expand this

exports.method = 'post';
exports.writes_db = false;
exports.authed = false;
exports.i18n = false;

var store = function (kpi_json, cb) {
  var options,
      db_url,
      kpi_req,
      kpi_resp = function (res) {
        logger.debug('KPI Backend responded ' + res.statusCode);
      };

  // Out of concern for the user's privacy, round the server timestamp
  // off to the nearest 10-minute mark.
  und.each(kpi_json, function (kpi) { delete kpi.local_timestamp;
    if (! kpi.timestamp) {
      kpi.timestamp = new Date().getTime();
    }
    kpi.timestamp = kpi.timestamp - (kpi.timestamp % TEN_MIN_IN_MS);
  });

  if (!! config.get('kpi_backend_db_url')) {

    var post_data = querystring.stringify({
      'data' : JSON.stringify(kpi_json)
    });

    var db_url = urlparse(config.get('kpi_backend_db_url'));
    options = {
          hostname: db_url.host,
          path: db_url.path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': post_data.length
          }
    };

    if (db_url.port) {
      options.port = db_url.port;
    }

    kpi_req = http.request(options);
    kpi_req.on('error', function (e) {
      // TODO statsd counter
      logger.error('KPI Backend request error: ' + e.message);
    });

    logger.debug("sending request to KPI backend" + config.get('kpi_backend_db_url'));
    kpi_req.write(post_data);
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
