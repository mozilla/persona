
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  var bid = BrowserID,
      model = bid.Models.InteractionData,
      testHelpers = bid.TestHelpers,
      testObjectValuesEqual = testHelpers.testObjectValuesEqual,
      xhr = bid.Mocks.xhr;

  module("common/js/models/interaction_data", {
    setup: function() {
      testHelpers.setup();
      localStorage.removeItem("interaction_data");
    },

    teardown: function() {
      testHelpers.teardown();
    }
  });

  test("after push, most recently pushed data available through getCurrent, getStaged gets previous data sets", function() {
    model.push({ lang: "foo" });
    equal(model.getCurrent().lang, "foo",
          "after pushing new interaction data, it's returned from .getCurrent()");

    equal(model.getStaged().length, 0, "no data is yet staged");

    model.push({ lang: "bar" });

    equal(model.getCurrent().lang, "bar", "current points to new data set")
    var staged = model.getStaged();

    equal(staged.length, 1, "only one staged item");
    testObjectValuesEqual(staged[0], { lang: "foo" });
  });

  test("setCurrent data overwrites current", function() {
    model.clearStaged();
    model.push({ lang: "foo" });
    model.setCurrent({ lang: "bar" });
    equal(model.getCurrent().lang, "bar",
          "overwriting current interaction data works");
  });

  asyncTest("publishCurrent publish current data", function() {
    model.push({ orphaned: false });
    model.publishCurrent(function(postedData) {
      ok(postedData, "data successfully posted");

      start();
    });
  });

  function testStagingContinuation(config, shouldHaveStagingContinuation) {
    model.push(config);

    model.publishCurrent(function() {
      model.push({ event_stream: [] });

      var eventStream = model.getCurrent().event_stream;
      equal(model.hasEvent(eventStream, "staging_continuation"),
          shouldHaveStagingContinuation);

      start();
    });
  }

  asyncTest("publishCurrent->push, non-orphaned with staging event - " +
                "no staging_continuation", function() {
    testStagingContinuation({
      orphaned: false,
      event_stream: [[ "user.user_staged" ]]
    }, false);
  });

  asyncTest("publishCurrent->push, orphaned without staging event - " +
                "no staging_continuation", function() {
    testStagingContinuation({
      orphaned: true,
      event_stream: []
    }, false);
  });

  asyncTest("publishCurrent->push, orphaned with staging event - " +
                "with staging_continuation", function() {
    testStagingContinuation({
      orphaned: true,
      event_stream: [[ "user.user_staged" ]]
    }, true);
  });

  test("clearStaged clears staged interaction data but leaves current data unaffected", function() {
    model.push({ lang: "bar" });
    model.clearStaged();
    equal(model.getStaged().length, 0,
          "after clearStageding, interaction data is zero length");
    equal(model.getCurrent().lang, "bar",
          "after clearStageding, current data is unaffected");
  });

  test("stageCurrent - stage the current data, if any. no data is current afterwards", function() {
    // There is no current data to stage.
    model.stageCurrent();
    equal(model.getStaged().length, 0, "no data to staged");

    model.push({ lang: "foo" });
    model.stageCurrent();

    equal(model.getStaged().length, 1, "current data staged");
    equal(typeof model.getCurrent(), "undefined", "current data removed after being staged");
  });

  asyncTest("publishStaged - publish any staged data", function() {
    // There is no currently staged data.
    model.publishStaged(function(status) {
      equal(status, false, "no data currently staged");

      // Simulate a throttling
      // desired result - data is purged from staging table

      // The first pushed data will become staged.
      model.push({ lang: "foo" });
      model.stageCurrent();

      xhr.useResult("throttle");
      model.publishStaged(function(status) {
        equal(false, status, "data throttling returns false status");
        // the previously staged data should we wiped on a throttling response.

        // When the interaction_data next completes, this will be the only data
        // that is pushed.
        var now = new Date().getTime();

        model.push({
          event_stream: [],
          sample_rate: 1,
          timestamp: now,
          local_timestamp: now,
          lang: "bar",
          number_emails: 1,
          number_sites_signed_in: 2,
          number_sites_remembered: 3,
          orphaned: false,
          new_account: true,
          email_type: "assertion",
          rp_api: "watch_without_onready"
        });
        model.stageCurrent();

        xhr.useResult("valid");
        model.publishStaged(function(postedData) {
          ok(postedData, "data successfully posted");
          equal(postedData.length, 1, "sending correct result sets");

          var mostRecentSessionData = postedData[0];
          testObjectValuesEqual(mostRecentSessionData, {
            event_stream: [],
            sample_rate: 1,
            timestamp: now,
            lang: "bar",
            number_emails: 1,
            number_sites_signed_in: 2,
            number_sites_remembered: 3,
            orphaned: false,
            new_account: true,
            email_type: "assertion",
            rp_api: "watch_without_onready"
          });

          testHelpers.testUndefined(mostRecentSessionData.local_timestamp,
              "non-whitelisted valued stripped");
          start();
        });
      });

    });

  });
}());
