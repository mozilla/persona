/*jshint browser:true, jquery: true, forin: true, laxbreak:true */
/*globals BrowserID: true, _:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      testHelpers = bid.TestHelpers,
      StateMachine = bid.StateMachine,
      stateMachine,
      mediator = bid.Mediator;

  module("common/js/state_machine", {
    setup: function() {
      testHelpers.setup();

      stateMachine = StateMachine.create();
      stateMachine.start();
    },
    teardown: function() {
      stateMachine.destroy();
      testHelpers.teardown();
    }
  });

  asyncTest("gotoState with implied save - call callback, state not saved until next gotoState", function() {
    var called;
    stateMachine.gotoState(function(options) {
      ok(true, "callback called");
      start();
    });
  });

  asyncTest("multiple gotoState, popState - takes state off stack and runs it", function() {
    var active;
    stateMachine.gotoState(function(options) {
      if(active) {
        ok(true, "callback called");
        start();
      }
    });
    stateMachine.gotoState(function() {});

    active = true;
    stateMachine.popState();
  });

  asyncTest("gotoState with explicit save=false - do not save to stack", function() {
    var active;
    stateMachine.gotoState(function(options) {
      if(active) {
        ok(true, "callback called");
        start();
      }
    });
    // This will not go on the stack when the next state is added.
    stateMachine.gotoState(false, function() {});

    // This will never go on the stack.
    stateMachine.gotoState(function() {});

    active = true;
    stateMachine.popState();
  });

  asyncTest("subscribe/publish - subscribe to the mediator, 3rd parameter to publish passed to handler's info", function() {
    // set up state that will simulate a state being started.
    var active = false;
    stateMachine.gotoState(function(info) {
      if(active) {
        equal(info.item, "value", "correct info passed to handler");
        start();
      }
    });

    stateMachine.subscribe("message", function(msg, info) {
      equal(info.item2, "value2", "correct info passed to message");

      // Start a new state;
      stateMachine.gotoState(function(){
        active = true;
        // this should cause the first state to run with the updated info.
        stateMachine.popState();
      }, info);

    });

    // simulate a message from inside the previous state that signals a new
    // state starting.
    mediator.publish("message", { item2: "value2" }, { item: "value" });
  });

  asyncTest("multiple calls to gotoState save states to stack correctly", function() {
    var active = false;

    stateMachine.gotoState(function() {
      if(active) {
        ok(true, "original state saved, re-gone to");
        start();
      }
    });

    // First item should go on stack.
    stateMachine.gotoState(false, function() {});

    // After this, no items on stack.
    stateMachine.popState();

    // First item should go on stack.
    stateMachine.gotoState(false, function() {});

    active = true;
    // After this, no items should be on stack, first item should be called.
    stateMachine.popState();
  });

}());
