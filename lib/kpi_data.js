/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This takes care of storing KPI (interaction) data with the Kpiggybank
 * backend.
 */

const
http = require('http'),
https = require('https'),
querystring = require('querystring'),
und = require('underscore'),
urlparse = require('urlparse'),
config = require('./configuration'),
logger = require('./logging/logging').logger,
TEN_MIN_IN_MS = 10 * 60 * 1000;

exports.store = function (kpi_json, cb) {
  var options,
      db_url,
      kpi_req,
      http_proxy;

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

    db_url = urlparse(config.get('kpi_backend_db_url'));

    http_proxy = config.has('http_proxy') ? config.get('http_proxy') : null;

    if (http_proxy && http_proxy.port && http_proxy.host) {
      options = {
        host: http_proxy.host,
        port: http_proxy.port,
        path: db_url,
        method: 'POST',
        agent: false,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': post_data.length
        }
      };
      kpi_req = http.request(options);
    } else {
      options = {
        hostname: db_url.host,
        path: db_url.path,
        method: 'POST',
        rejectUnauthorized: true,
        agent: false,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': post_data.length
        }
      };

      if (db_url.port) {
        options.port = db_url.port;
      }

      var protocol = (db_url.scheme === 'https') ? https : http;
      kpi_req = protocol.request(options);
    }

    kpi_req.on('response', function(res) {
      if (res.statusCode !== 201) {
        logger.warn('KPI Backend (or proxy) response code is not 201: ' + res.statusCode);
      } else {
        logger.info('interaction data successfully posted to KPI Backend');
      }
    });

    kpi_req.on('error', function (e) {
      // TODO statsd counter
      logger.error('KPI Backend request error: ' + e.message);
    });

    logger.debug("sending request to KPI backend: " + config.get('kpi_backend_db_url'));
    kpi_req.write(post_data);
    kpi_req.end();

  } else {
    cb(false);
  }
};


