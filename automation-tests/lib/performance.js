/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This module is responsible for sending collecting KPI results and saving
 * performance information to performance_results.txt. The results are saved
 * with this format:
 *
 * Test Name (cache [empty||full]), I:<time_ms>, D:<time_ms>
 *
 * I is the amount of time until the communication Iframe is ready.
 * D is the amount of time until the user can interact with the Dialog.
 *
 * Several environment variables can be specified to control behavior.
 *
 * TEST_NAME - Name of test. Defaults to `Unnamed`
 * KPIGGYBANK_URL - URL of the KPiggybank server.
 *     Defaults are found in urls.js
 * OUTPUT_PATH - Where to save results. Defaults to
 *     `../performance_results.txt`
 */

const
path = require('path'),
url = require('url'),
https = require('https'),
fs = require('fs'),
persona_urls = require('./urls.js');

const TEST_NAME = process.env.TEST_NAME || 'Unnamed';
const KPIGGYBANK_URL = process.env.KPIGGYBANK_URL || persona_urls.kpiggybank;
const RESULTS_PATH = process.env.OUTPUT_PATH
          ? path.resolve(path.join(__dirname, '..'), process.env.OUTPUT_PATH)
          : path.join(__dirname, '..', 'performance_results.txt');

exports.REQUEST_TIMEOUT = 5000;

/**
 * Save the last result sent to the KPI server to `RESULTS_PATH`.
 *
 * @method save
 * @api public
 */

exports.save = function(cacheStatus, done) {
  exports.getResult(function(err, result) {
    if (err) return done(err);

    exports.writeResult(cacheStatus, result, done);
  });
};


exports.getResult = function(done) {
  var kpiUrl = KPIGGYBANK_URL;
  https.get({
    method: 'GET',
    hostname: url.parse(kpiUrl).hostname,
    path: '/wsapi/interaction_data/last'
  }, function(res) {
    var data = '';
    res.on('data', function(chunk) {
      data += chunk;
    });
    res.on('end', function() {
      try {
        var result = JSON.parse(data);
        if (!result) return done(new Error("no result"));
        done && done(null, result.value);
      } catch(e) {
        done(e);
      }
    });
  }).setTimeout(exports.REQUEST_TIMEOUT, function() {
    done(new Error("timeout for " + kpiUrl));
  });
};

exports.writeResult = function(cacheStatus, result, done) {
  try {
    var data = TEST_NAME
        + " (" + cacheStatus + ")"
        + ", I:" + result.ready_time_ms
        + ", D:" + getCanInteractMS(result.event_stream)
        + "\n";

    fs.appendFile(RESULTS_PATH, data, function(err) {
      if (err) return done(err);

      done(null, result);
    });
  } catch(e) {
    done(e);
  }
};

function getCanInteract(eventStream) {
  for (var i = 0, result; result = eventStream[i]; ++i) {
    if (/can_interact/.test(result[0])) return result;
  }
}

function getCanInteractMS(eventStream) {
  var canInteractResult = getCanInteract(eventStream);
  return (canInteractResult && canInteractResult[1]) || "undefined";
}

