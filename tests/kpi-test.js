#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const assert = require('assert');
const vows = require('vows');
const start_stop = require('./lib/start-stop');
const wsapi = require('./lib/wsapi');
const HekaTransport = require('../lib/logging/transports/heka-console');

require('./lib/test_env');

var suite = vows.describe('interaction-data');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

suite.addBatch({
  "POST /wsapi/interaction_data": {
    topic: wsapi.post('/wsapi/interaction_data', {}),
    "succeeds": function(err, r) {
      assert.isNull(err);
      assert.strictEqual(r.code, 200);
    }
  }
});

function noOp() {}

suite.addBatch({
  "staging, verification, and kpi events": {
    topic: function() {
      this.consoleMock = {
        entries: [],
        log: function (entry) {
          this.entries.push(entry);
        }
      };

      this.expectedEvents = [
        'stage_email.success',
        'stage_reset.success',
        'stage_reverify.success',
        'stage_transition.success',
        'stage_user.success',
        'complete_email_confirmation.success',
        'complete_reset.success',
        'complete_transition.success',
        'complete_user_creation.success',
        'idp.auth_cancel',
        'idp.auth_return',
        'idp.create_new_user',
        'kpi'
      ];

      var kpiTransport = new HekaTransport({
        console: this.consoleMock
      });

      this.expectedEvents.forEach(function(event) {
        kpiTransport.log('info', event, null, noOp);
      });

      return this.consoleMock.entries;
    },

    "are logged to the console for Heka": function (entries) {
      var expectedEvents = this.expectedEvents;

      // The test here is a bit backwards. Take the original set of events to
      // test and remove the events that have been added to the queue. Hope
      // that none remain.
      entries.forEach(function(entry) {
        var kpi = JSON.parse(entry);
        var eventName = kpi.Type;
        var index = expectedEvents.indexOf(eventName);
        expectedEvents.splice(index, 1);
      });

      assert.equal(expectedEvents.length, 0);
    }
  }
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);

