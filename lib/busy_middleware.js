/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// export a function that is express middleware which blocks requests
// when we're too busy.  uses https://npmjs.org/toobusy by lloyd

var toobusy = require('toobusy'),
     config = require('./configuration');

const throttlingEnabled = !config.get('disable_request_throttling');

if (throttlingEnabled) {
  // set maximum event loop lag from configuration, which controls
  // just how busy we need to be before sending pre-emptive 503s.
  toobusy.maxLag(config.get('maximum_event_loop_lag'));
} else {
  // when disabled, shutdown toobusy, which casues it to stop polling
  // the event loop to determine server load.
  toobusy.shutdown();
}

module.exports = function(req, res, next) {
  if (throttlingEnabled && toobusy()) {
    res.send("server is too busy", {"Content-Type": "text/plain"}, 503);
  } else {
    next();
  }
};

module.exports.shutdown = toobusy.shutdown;
