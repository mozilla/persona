/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      testHelpers = bid.TestHelpers,
      network = bid.Network,
      storage = bid.Storage,
      controller;

  module("shared/modules/interaction_data", {
    setup: testHelpers.setup,
    teardown: function() {
      testHelpers.teardown();

      controller.destroy();
    }
  });

  function createController(config) {
    config = _.extend({ samplingEnabled: true }, config);
    controller = BrowserID.Modules.InteractionData.create();
    controller.start(config);
  }

  function indexOfEvent(eventStream, eventName) {
    for(var event, i = 0; event = eventStream[i]; ++i) {
      if(event[0] === eventName) return i;
    }

    return -1;
  }

  asyncTest("samplingEnabled - ensure data collection working as expected", function() {
    createController();

    controller.addEvent("before_session_context");

    var events = controller.getEventStream();
    ok(indexOfEvent(events, "before_session_context") > -1, "before_session_context correctly saved to event stream");
    ok(indexOfEvent(events, "after_session_context") === -1, "after_session_context not yet added to current event stream");

    // with context initializes the current stored data.
    network.withContext(function() {
      var data = controller.getCurrentStoredData();

      // Make sure expected items are in the current stored data.
      testHelpers.testKeysInObject(data, ["event_stream", "sample_rate", "timestamp", "lang"]);

      controller.addEvent("after_session_context");

      var events = controller.getEventStream();

      // Make sure both the before_session_context and after_session_context
      // are both on the event stream.
      ok(indexOfEvent(events, "before_session_context") > -1, "before_session_context correctly saved to current event stream");
      ok(indexOfEvent(events, "after_session_context") > -1, "after_session_context correctly saved to current event stream");


      // Ensure that the event name as well as relative time are saved for an
      // event.
      var index = indexOfEvent(events, "after_session_context");
      var event = events[index];

      ok(index > -1, "after_session_context correctly saved to current event stream");
      equal(event[0], "after_session_context", "name stored");
      equal(typeof event[1], "number", "time stored");

      start();
    });

  });

  asyncTest("publish data", function() {
    createController();

    // force saved data to be cleared.
    storage.interactionData.clear();
    controller.publishStored(function(status) {
      equal(status, false, "no data to publish");

      // session context is required start saving events to localStorage.
      network.withContext(function() {

        // Add an event which should allow us to publish
        controller.addEvent("something_special");
        controller.publishStored(function(status) {
          equal(status, true, "data correctly published");

          start();
        });
      });
    });
  });

  asyncTest("samplingEnabled set to false - no data collection occurs", function() {
    createController({ samplingEnabled: false });

    // the initial with_context will send off any stored data, there should be
    // no stored data.
    network.withContext(function() {
      controller.addEvent("after_session_context");
      var events = controller.getEventStream();

      var index = indexOfEvent(events, "after_session_context");
      equal(index, -1, "events not being stored");

      equal(typeof controller.getCurrentStoredData(), "undefined", "no stored data");

      controller.publishStored(function(status) {
        equal(status, false, "there was no data to publish");
        start();
      });
    });
  });

  asyncTest("continue: true, data collection permitted on previous session - continue appending data to previous session", function() {
    createController();

    controller.addEvent("session1_before_session_context");
    network.withContext(function() {
      controller.addEvent("session1_after_session_context");

      // simulate a restart of the dialog.  Clear the session_context and then
      // re-get session context.
      controller = null;
      network.clearContext();
      createController({ continuation: true });

      controller.addEvent("session2_before_session_context");
      network.withContext(function() {
        controller.addEvent("session2_after_session_context");

        var events = controller.getEventStream();

        ok(indexOfEvent(events, "session1_before_session_context") > -1, "session1_before_session_context correctly saved to current event stream");
        ok(indexOfEvent(events, "session1_after_session_context") > -1, "session1_after_session_context correctly saved to current event stream");
        ok(indexOfEvent(events, "session2_before_session_context") > -1, "session2_before_session_context correctly saved to current event stream");
        ok(indexOfEvent(events, "session2_after_session_context") > -1, "session2_after_session_context correctly saved to current event stream");

      });

      start();
    });

  });

  asyncTest("continue: true, data collection not permitted in previous session - no data collected", function() {
    createController({ samplingEnabled: false });

    controller.addEvent("session1_before_session_context");
    network.withContext(function() {
      controller.addEvent("session1_after_session_context");

      // simulate a restart of the dialog.  Clear the session_context and then
      // re-get session context.
      controller = null;
      network.clearContext();
      createController({ continuation: true });

      controller.addEvent("session2_before_session_context");
      network.withContext(function() {
        controller.addEvent("session2_after_session_context");

        var events = controller.getEventStream();

        ok(indexOfEvent(events, "session1_before_session_context") === -1, "no data collected");
        ok(indexOfEvent(events, "session1_after_session_context") === -1, "no data collected");
        ok(indexOfEvent(events, "session2_before_session_context") === -1, "no data collected");
        ok(indexOfEvent(events, "session2_after_session_context") === -1, "no data collected");

        controller.publishStored(function(status) {
          equal(status, false, "there was no data to publish");
          start();
        });
      });
    });

  });


}());
