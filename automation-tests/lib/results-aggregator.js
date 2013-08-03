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

/*
 * Asynchronous exceptions come in on stderr. These errors are not reported
 * in the JSON reporter and must be parsed manually from the stderr output.
 * Async errors take the form of:
 *
 *    /file_path:lineno
 *    line_causing_problem
 *          ^ (arrow to location)
 *    TypeOfError & StackTrace
 *
 * Example of an error:
 *     /Users/stomlinson/development/browserid/automation-tests/tests/sign-in-test.js:45
 *     o['b'];
 *     ^
 *     ReferenceError: o is not defined
 *         at runner.run.throw an async error (/Users/stomlinson/development/browserid/automation-tests/tests/sign-in-test.js:45:11)
 *         at process.startup.processNextTick.process._tickCallback (node.js:244:9)
 *
 *
 * Second example:
 *     timers.js:103
 *     if (!process.listeners('uncaughtException').length) throw e;
 *     ^
 *     ReferenceError: o is not defined
 *         at Object.runner.run.throw an async error [as _onTimeout] (/Users/stomlinson/development/browserid/automation-tests/tests/sign-in-test.js:45:11)
 *         at Timer.list.ontimeout (timers.js:101:19)
 *
 * Each line of the exception is reported to stderr as its own message. This
 * means that once an error is detected on stderr, subsequent messages must be
 * appended until the entire message is captured.
 *
 * To fix this (ver brittle):
 * Look for the test_path on a line.
 * Capture and append each message until the message with "Error: "
 */
ResultsAggregator.prototype.parseErrorLine = function(msg) {
  /*
   * look for a message that contains the test path, if the line starts with
   * the path, there is an asynchronous error.
   */
  msg = msg && msg.trim();
  if (!msg) return;

  if (/https:\/\/saucelabs\.com\/tests\//.test(msg)) {
    this.addInterestingURL(msg);
  }

  if (!this.captureLines && /\.js:\d+/.test(msg)) {
    /*
     * The first line is the file name which is already reported as part of the
     * output. Since this is duplicate data, do not capture it.
     */
    this.currentException = "";
    this.captureLines = true;
  }
  else if (this.captureLines) {
    this.currentException += (msg + "\n");

    // The last message contains the Error: and stack trace.
    this.captureLines = !/Error:/.test(msg);

    if (!this.captureLines) {
      this.current.name = getSpecFromError(msg);
      this.handleError(this.currentException);
    }
  }
  /*
   * If neither branch matched, this message is either not an error message
   * or we are not collecting messages.
   */
};

ResultsAggregator.prototype.parseLine = function(msg) {
  var self = this;
  /*
   * Multiple results can come in on one message, split and process each
   * individually
   */
  msg.split("\n").forEach(function(msg) {
    msg = msg.trim();
    if (msg.length === 0) return;
    try {
      msg = JSON.parse(msg);
    } catch(e) {
      self.oddballMessages.push(msg.trim());
      return;
    }

    if (msg["0"] === 'context') {
      self.current.name = msg["1"];
    /*
     * If there is a synchronous exception, no "context" message will be
     * sent, this means the spec name must be fetched from the error message.
     */
    } else if (msg["0"] === 'error' && msg["1"].context) {
      self.current.name = msg["1"].context;
      self.handleError(msg["1"].exception);
    // vow is sent when a vow runs and completes normally.
    } else if (msg["0"] === 'vow') {
      if (msg["1"].status !== 'honored') {
        self.handleError(msg["1"].exception);
      } else {
        self.emit('pass');
      }
    /*
     * end and finish are the last messages sent
     * end is sent if the test is completes normally
     * finish is sent if the test excepts
     */
    } else if (msg["0"] === 'end' || msg["0"] === 'finish') {
      if (self.current.errors) {
        self.failures.push(self.current);
      } else {
        self.successes.push(self.current);
      }
      self.current = {};
    }
  });
};

ResultsAggregator.prototype.handleError = function(errorType) {
  this.current.success = false;
  this.current.errors = this.current.errors || [];
  this.current.errors.push(errorType);
  this.emit('fail');
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
};

module.exports = ResultsAggregator;

function getSpecFromError(msg) {
  /* test name on exception is in the form of:
   *   at runner.run<test_name> (<location>)
   * Example:
   *   at runner.run.throw an async error in process.nextTick (/Users/stomlinson/development/browserid/automation-tests/tests/minimal-test.js:54:7)
   */
  var possibleNameMatch = /runner\.run\.(.*) \(/.exec(msg);
  var name = (possibleNameMatch && possibleNameMatch[1])
                || "unknown spec";
  return name;
}

