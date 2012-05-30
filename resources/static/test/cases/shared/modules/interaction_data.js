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
      model = bid.Models.InteractionData,
      xhr = bid.Mocks.xhr,
      mediator = bid.Mediator,
      controller;

  module("shared/modules/interaction_data", {
    setup: function() {
      testHelpers.setup();
      localStorage.removeItem("interaction_data");
    },
    teardown: function() {
      testHelpers.teardown();

      controller.destroy();
    }
  });

  function createController(setKPINameTable, config) {
    if (typeof setKPINameTable !== "boolean") {
      config = setKPINameTable;
      setKPINameTable = false;
    }

    config = _.extend({ samplingEnabled: true }, config);
    controller = BrowserID.Modules.InteractionData.create();
    controller.start(config);

    controller.setNameTable({
      before_session_context: null,
      after_session_context: null,
      session1_before_session_context: null,
      session1_after_session_context: null,
      session2_before_session_context: null,
      session2_after_session_context: null,
      initial_string_name: "translated_name",
      initial_function_name: function(msg, data) {
        return "function_translation." + msg;
      }
    });

  }

  function indexOfEvent(eventStream, eventName) {
    for(var event, i = 0; event = eventStream[i]; ++i) {
      if(event[0] === eventName) return i;
    }

    return -1;
  }

  asyncTest("samplingEnabled - ensure data collection working as expected", function() {
    // Desired sequence:
    // 1. When session_context completes, initialize this session's interaction
    // data, sends previous session's data.
    // 2. when network.sendInteractionData completes, previous session's data is
    // erased, current session's data is unaffected.

    // simulate data stored for last session
    model.push({ timestamp: new Date().getTime() });

    createController();

    controller.addEvent("before_session_context");

    var events = controller.getCurrentEventStream();
    ok(indexOfEvent(events, "before_session_context") > -1, "before_session_context correctly saved to event stream");

    // Add an XHR delay to simulate interaction_data completeing after
    // session_context completes.
    xhr.setDelay(5);

    mediator.subscribe("interaction_data_send_complete", function() {
      var data = controller.getCurrent();

      // Make sure expected items are in the current stored data.
      testHelpers.testKeysInObject(data, ["event_stream", "sample_rate", "timestamp", "lang"]);

      controller.addEvent("after_session_context");
      controller.addEvent("after_session_context");

      // The next two are translated from mediator names to names usable by the
      // KPI backend.

      // translated to "translated_name"
      controller.addEvent("initial_string_name");
      // translated to "function_translation.initial_function_name"
      controller.addEvent("initial_function_name");

      events = controller.getCurrentEventStream();
      // Make sure both the before_session_context and after_session_context
      // are both on the event stream.
      ok(indexOfEvent(events, "before_session_context") > -1, "before_session_context correctly saved to current event stream");
      ok(indexOfEvent(events, "after_session_context") > -1, "after_session_context correctly saved to current event stream");
      ok(indexOfEvent(events, "translated_name") > -1, "string translation - translated_name correctly saved to current event stream");
      ok(indexOfEvent(events, "function_translation.initial_function_name") > -1, "function translation - function_translation.initial_function_name correctly saved to current event stream");


      // Ensure that the event name as well as relative time are saved for an
      // event.
      var index = indexOfEvent(events, "after_session_context");
      var event = events[index];

      ok(index > -1, "after_session_context correctly saved to current event stream");
      equal(event[0], "after_session_context", "name stored");
      equal(typeof event[1], "number", "time stored");

      start();
    });

    network.withContext();
  });

  asyncTest("samplingEnabled set to false - no data collection occurs", function() {
    createController({ samplingEnabled: false });

    // the initial with_context will send off any stored data, there should be
    // no stored data.
    network.withContext(function() {
      controller.addEvent("after_session_context");

      equal(typeof controller.getCurrent(), "undefined", "no stored data");
      equal(typeof controller.getCurrentEventStream(), "undefined", "no data stored");

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

        var events = controller.getCurrentEventStream();

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

        equal(typeof controller.getCurrent(), "undefined", "no data collected");
        equal(typeof controller.getCurrentEventStream(), "undefined", "no data collected");

        controller.publishStored(function(status) {
          equal(status, false, "there was no data to publish");
          start();
        });
      });
    });
  });


  asyncTest("simulate failed starts - data not sent until second successful session_context", function() {
    // simulate three dialogs being opened.
    // The first open dialog does not complete session_context, so data is
    // never collected/sent for this session.
    // The second has session_context complete, it starts collecting data which
    // is sent when the third dialog has its session_context complete.
    // The third has session_context complete and sends data for the second
    // dialog opening.


    // First open dialog never has session_context complete. Data is not
    // collected.
    createController();
    controller.addEvent("session1_before_session_context");

    // Second open dialog is the first to successfully complete
    // session_context, data should be collected.
    createController();
    controller.addEvent("session2_before_session_context");
    network.withContext(function() {

      // Third open dialog successfully completes session_context, should send
      // data for the 2nd open dialog once session_context completes.
      createController();
      controller.addEvent("session2_before_session_context");

      network.withContext(function() {
        var request = xhr.getLastRequest('/wsapi/interaction_data'),
            previousSessionsData = JSON.parse(request.data).data;

        equal(previousSessionsData.length, 1, "sending correct result sets");
        start();
      });
    });
  });

}());
