/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      testHelpers = bid.TestHelpers,
      user = bid.User,
      network = bid.Network,
      storage = bid.Storage,
      errors = bid.Errors,
      model = bid.Models.InteractionData,
      xhr = bid.Mocks.xhr,
      mediator = bid.Mediator,
      controller;

  module("common/js/modules/interaction_data", {
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
    user.clearContext();
    if (typeof setKPINameTable !== "boolean") {
      config = setKPINameTable;
      setKPINameTable = false;
    }

    config = _.extend({ samplingEnabled: true }, config);
    controller = BrowserID.Modules.InteractionData.create();
    controller.start(config);

    if (setKPINameTable) {
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

  }

  function indexOfEvent(eventStream, eventName) {
    for (var event, i = 0; event = eventStream[i]; ++i) {
      if (event[0] === eventName) return i;
    }

    return -1;
  }

  asyncTest("addEvent - return an object with the event", function() {
    createController(true);

    var eventName = "before_session_context",
        event = controller.addEvent(eventName);

    equal(event[0], "before_session_context", "event name set correctly");
    equal(typeof event[1], "number", "event offset set: " + event[1]);

    start();
  });

  asyncTest("addEvent with eventTime and duration - eventTime used as basis to calculate offset, duration is third item in event", function() {
    createController(true);

    var eventName = "before_session_context",
        event = controller.addEvent(eventName, {
          eventTime: new Date().getTime() + 10,
          duration: 110
        });

    equal(event[0], eventName, "event name set correctly");
    // this is a potentially fragile test, depending on how fast the
    // environment is. If this is run on a slow VM, the event offset
    // could be > 20.
    testHelpers.testNumberInRange(event[1], 10, 20,
        "event offset from start of controller set correctly");
    ok(event[2], 110, "duration has been stored");

    start();
  });

  asyncTest("samplingEnabled - ensure data collection working as expected", function() {
    // Desired sequence:
    // 1. When session_context completes, initialize this session's interaction
    // data, sends previous session's data.
    // 2. when network.sendInteractionData completes, previous session's data is
    // erased, current session's data is unaffected.

    // simulate data stored for last session
    model.push({ timestamp: new Date().getTime() });

    createController(true);

    controller.addEvent("before_session_context");
    controller.addKPIData({
      kpi_before_session_context: true
    });

    var events = controller.getCurrentEventStream();
    ok(indexOfEvent(events, "before_session_context") > -1, "before_session_context correctly saved to event stream");

    // Add an XHR delay to simulate interaction_data completeing after
    // session_context completes.
    xhr.setDelay(5);

    mediator.subscribe("interaction_data_send_complete", function() {
      var data = controller.getCurrentKPIs();

      // Make sure expected items are in the current stored data.
      testHelpers.testKeysInObject(data, ["event_stream", "sample_rate", "timestamp", "lang", "new_account", "kpi_before_session_context"]);

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
    createController(true, { samplingEnabled: false });

    // the initial with_context will send off any stored data, there should be
    // no stored data.
    network.withContext(function() {
      controller.addEvent("after_session_context");

      equal(typeof controller.getCurrentKPIs(), "undefined", "no stored data");
      equal(typeof controller.getCurrentEventStream(), "undefined", "no data stored");

      controller.publishCurrent(function(status) {
        equal(status, false, "there was no data to publish");
        start();
      });
    });
  });

  asyncTest("continue: true, data collection permitted on previous session - continue appending data to previous session", function() {
    createController(true);

    controller.addEvent("session1_before_session_context");
    network.withContext(function() {
      controller.addEvent("session1_after_session_context");

      // simulate a restart of the dialog.  Clear the session_context and then
      // re-get session context.
      controller = null;
      user.clearContext();
      createController(true, { continuation: true });

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
      user.clearContext();
      createController({ continuation: true });

      controller.addEvent("session2_before_session_context");
      network.withContext(function() {
        controller.addEvent("session2_after_session_context");

        equal(typeof controller.getCurrentKPIs(), "undefined", "no data collected");
        equal(typeof controller.getCurrentEventStream(), "undefined", "no data collected");

        controller.publishCurrent(function(status) {
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
    xhr.useResult("contextAjaxError");
    createController();
    controller.addEvent("session1_before_session_context");

    // Second open dialog is the first to successfully complete
    // session_context, data should be collected.
    xhr.useResult("valid");
    createController();
    controller.addEvent("session2_before_session_context");

    // Third open dialog successfully completes session_context, should send
    // data for the 2nd open dialog once session_context completes.
    createController();
    controller.addEvent("session2_before_session_context");

    var request = xhr.getLastRequest('/wsapi/interaction_data'),
        previousSessionsData = JSON.parse(request.data).data;

    equal(previousSessionsData.length, 1, "sending correct result sets");
    start();
  });

  asyncTest("timestamp rounded to 10 minute intervals", function() {
    var TEN_MINS_IN_MS = 10 * 60 * 1000;
    createController();
    network.withContext(function() {
      var timestamp = controller.getCurrentKPIs().timestamp;
      ok(timestamp, "a timestamp has been passed: " + timestamp);
      equal(timestamp % TEN_MINS_IN_MS, 0, "timestamp has been rounded to a 10 minute interval");
      start();
    });
  });

  asyncTest("kpi_data message only adds fields to current kpi_data if sampling is enabled", function() {
    createController();
    network.withContext(function() {
      // number_emails will not be added to KPI data because sampling is
      // disabled.
      controller.disable();
      mediator.publish("kpi_data", { number_emails: 1 });
      testHelpers.testUndefined(controller.getCurrentKPIs());

      // number_emails will be added to KPI data because sampling is
      // disabled.
      controller.enable();
      mediator.publish("kpi_data", { number_emails: 2 });
      testHelpers.testObjectValuesEqual(controller.getCurrentKPIs(), {
        number_emails: 2
      });

      start();
    });
  });

  asyncTest("start_time message sets the startTime to calculate event time offset", function() {
    createController(true);

    // set a fake startTime to simulate the dialog load delay. This should make
    // every event be offset by at least 1000 ms.
    var startTime = new Date().getTime() - 1000;
    controller.addEvent("start_time", startTime);

    network.withContext(function() {
      var eventOffset = controller.addEvent("session1_after_session_context")[1];

      ok(eventOffset >= 1000 && eventOffset <= 1100, "eventOffset at least 1000 ms but less than 1100: " + eventOffset);
      start();
    });
  });

  test("start_time does not cause blowup if sampling disabled", function() {
    createController(true, {
      samplingEnabled: false
    });

    // set a fake startTime to simulate the dialog load delay. This should make
    // every event be offset by at least 1000 ms.
    var startTime = new Date().getTime() - 1000;
    try {
      controller.addEvent("start_time", startTime);
    } catch(e) {
      ok(false);
    }
  });

  asyncTest("start_time adjusts date of already added events", function() {
    // create a date that is one second ago that will be used to update the
    // start_time.
    var startTime = new Date().getTime() - 1000;

    createController(true);

    // create an event that has its offset updated.
    var eventName = "session1_before_session_context",
        origOffset = controller.addEvent(eventName)[1];

    ok(origOffset >= 0 && origOffset <= 100, "expect less than 100ms of offset before new start_time is set: " + origOffset);

    // Setting the start_time should cause the event's offset to be updated.
    // Since the new startTime is 1 second before the previous startTime,
    // the offset of each event should be increased by one second.
    controller.addEvent("start_time", startTime);

    var eventStream = controller.getCurrentEventStream();

    var index = indexOfEvent(eventStream, eventName);
    var event = eventStream[index];
    var newOffset = event[1];
    ok(newOffset >= 1000, "event's offset has been updated (orig-new): " + origOffset + "-" + newOffset);

    start();
  });

  asyncTest("GET data stripped from xhr_complete messages", function() {
    createController();

    controller.addEvent("xhr_complete", {
      network: {
        type: "GET",
        url: "/wsapi/user_creation_status?email=testuser@testuser.com"
      }
    });

    var eventStream = controller.getCurrentEventStream();
    var xhrEvent = eventStream[eventStream.length - 1];

    // Is GET data stripped?
    equal(xhrEvent[0], "xhr_complete.GET/wsapi/user_creation_status");

    start();
  });

  function testErrorScreen(config, expectedErrorType) {
    createController();
    controller.addEvent("error_screen", config);

    var eventStream = controller.getCurrentEventStream();
    var errorEvent = eventStream.pop();

    equal(errorEvent[0], expectedErrorType);
  }

  test("error_screen formats an error object", function() {
    testErrorScreen({
      action: errors.addressInfo,
      network: {
        status: 503
      }
    }, "screen.error.addressInfo.503");
  });

  test("error_screen takes care of custom error types", function() {
    testErrorScreen({
      action: {
        title: "custom error type"
      }
    }, "screen.error.custom error type");
  });

  test("error_screen takes care of error type without title", function() {
    testErrorScreen({
      action: { }
    }, "screen.error.unknown");
  });

  asyncTest("Consecutive xhr_complete messages for the same URL only have one entry", function() {
    createController();

    var REPEAT_COUNT = 5;

    controller.addEvent("xhr_complete", {
      network: {
        type: "GET",
        url: "/wsapi/session_context",
        duration: 13
      }
    });

    for(var i = 0; i < REPEAT_COUNT; i++) {
      controller.addEvent("xhr_complete", {
        network: {
          type: "GET",
          url: "/wsapi/user_creation_status?email=testuser@testuser.com",
          duration: 6
        }
      });
    }

    var eventStream = controller.getCurrentEventStream();
    // Were consecutive XHR events of the same URL prevented?
    equal(eventStream.length, 2);

    var firstEvent = eventStream[0];
    var secondEvent = eventStream[1];

    equal(firstEvent[0], "xhr_complete.GET/wsapi/session_context");
    equal(secondEvent[0], "xhr_complete.GET/wsapi/user_creation_status");
    equal(secondEvent[controller.REPEAT_COUNT_INDEX], REPEAT_COUNT);

    start();
  });

}());
