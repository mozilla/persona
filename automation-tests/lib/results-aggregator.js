/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var utils = require('util'),
   events = require('events');

function ResultsAggregator() {
  // tests which have completed successfully
  this.successes = [];
  // tests which have failed
  this.failures = [];
  // interesting (saucelabs) urls dropped along the way
  this.urls = [];
  // strange non-json messages that we could not understand emitted by the test.
  this.oddballMessages = [];
  // information about the current test
  this.current = { };
}

utils.inherits(ResultsAggregator, events.EventEmitter);

ResultsAggregator.prototype.parseLine = function(msg) {
  var self = this;
  msg.split("\n").forEach(function(msg) {
    msg = msg.trim();
    if (msg.length === 0) return;
    try {
      msg = JSON.parse(msg);
    } catch(e) {
      self.oddballMessages.push(msg.trim());
      return;
    }
    // now handle the message
    if (msg["0"] === 'context') {
      self.current.name = msg["1"];
    } else if (msg["0"] === 'end') {
      if (self.current.errors) {
        self.failures.push(self.current);
      } else {
        self.successes.push(self.current);
      }
      self.current = {};
    } else if (msg["0"] === 'vow') {
      if (msg["1"].status !== 'honored') {
        self.current.success = false;
        self.current.errors = self.current.errors || [];
        self.current.errors.push(msg["1"].exception);
        self.emit('fail');
      } else {
        self.emit('pass');
      }
    }
  });
};

ResultsAggregator.prototype.setName = function(testName) {
  this.name = testName;
};

ResultsAggregator.prototype.addInterestingURL = function(url) {
  this.urls.push(url);
};

ResultsAggregator.prototype.results = function() {
  return {
    name: this.name,
    success: !this.failures.length,
    passed: this.successes.length,
    failed: this.failures.length,
    unhandledMessages: this.oddballMessages,
    errorDetails: this.failures,
    urls: this.urls
  };
}

module.exports = ResultsAggregator;
