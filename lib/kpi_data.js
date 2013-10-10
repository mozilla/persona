/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This takes care of storing KPI (interaction) data with the Kpiggybank
 * backend.
 */

const querystring = require('querystring');
const und = require('underscore');
const urlparse = require('urlparse');
const config = require('./configuration');
const logger = require('./logging/logging').logger;
const TEN_MIN_IN_MS = 10 * 60 * 1000;

// http and https are vars to override for testing.
var http = require('http');
var https = require('https');

exports.init = function(config) {
  config = config || {};

  // overrides for testing.
  if (config.http) http = config.http;
  if (config.https) https = config.https;
};

exports.store = function (kpi_data, cb) {
  try {
    if (! config.get('kpi.backend_db_url')) return cb(null, false);

    roundTimestamps(kpi_data);

    var post_data = getPostData(kpi_data);
    var kpi_req = getRequest(post_data);

    kpi_req.on('response', onResponse.bind(null, cb));
    kpi_req.on('error', onError);

    logger.debug("sending request to KPI backend: "
                      + config.get('kpi.backend_db_url'));
    kpi_req.write(post_data);
    kpi_req.end();

    return kpi_req;
  } catch(e) {
    cb(e);
  }
};

function onResponse(cb, res) {
  if (res.statusCode !== 201) {
    logger.warn('KPI Backend (or proxy) response code is not 201: '
                      + res.statusCode);
    return cb(null, false);
  }

  logger.info('interaction data successfully posted to KPI Backend');
  cb(null, true);
}

function onError(e) {
  // TODO statsd counter
  logger.error('KPI Backend request error: ' + e.message);
}

function roundTimestamps(kpi_data) {
  // Out of concern for the user's privacy, round the server timestamp
  // off to the nearest 10-minute mark.
  und.each(kpi_data, function (kpi) { delete kpi.local_timestamp;
    if (! kpi.timestamp) {
      kpi.timestamp = new Date().getTime();
    }
    kpi.timestamp = kpi.timestamp - (kpi.timestamp % TEN_MIN_IN_MS);
  });
}

function getPostData(kpi_data) {
  return querystring.stringify({
    'data' : JSON.stringify(kpi_data)
  });
}

function getRequest(post_data) {
  var kpi_req;
  var db_url = urlparse(config.get('kpi.backend_db_url'));
  var http_proxy = config.has('http_proxy') ? config.get('http_proxy') : null;
  var options;

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

  return kpi_req;
}
