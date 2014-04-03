/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function(undefined) {
  "use strict";

  var testHelpers = BrowserID.TestHelpers;

  module("include.js");

  function noOp() {}

  test("navigator.id is available", function() {
    equal(typeof navigator.id, "object", "navigator.id namespace is available");
  });

  test("expected public API functions available", function() {
    _.each([
      "get",
      "getVerifiedEmail",
      "logout",
      "request",
      "watch"
    ], function(item, index) {
      equal(typeof navigator.id[ item ], "function", "navigator.id." + item + " is available");
    });
  });

  test("DOM calls fails when unbound from navigator.id", function() {
    _.each([
      "watch",
      "request",
      "logout"
    ], function(item, index) {
      var the_func = navigator.id[item];

      var fails = false;
      try {
        the_func();
      } catch (x) {
        fails = true;
      }

      ok(fails);
    });
  });

  test("watch only accepts null, undefined, false, or a string for loggedInUser", function() {
    /* Causes weird, intermittant errors. Possibly an erroneous test. */
    // a string, null, false, and undefined are valid
    // testWatchIsHappy("strings@are.valid");
    // testWatchIsHappy(null);
    // testWatchIsHappy(undefined);
    // testWatchIsHappy(false);

    //an object, an array, true, or a number are not.
    testWatchIsSad(true);
    testWatchIsSad({});
    testWatchIsSad([]);
    testWatchIsSad(1);
  });


  test("stateless arguments options", function() {
    /* Causes weird, intermittant errors. Possibly an erroneous test. */
    // ok(watch({ onlogin: noOp }), "no logout means stateless");

    ok(!watch({ onlogin: noOp, loggedInUser: 'asdf' }), 'stateless cant use loggedInUser');
    ok(!watch({ onlogin: noOp, onmatch: noOp }), 'stateless cant use onmatch');
    ok(!watch({ onlogin: noOp, onready: noOp }), 'stateless cant use onready');
  });

  function testWatchIsHappy(loggedInUser) {
    var err;
    try {
      callWatch(loggedInUser);
    } catch(e) {
      err = e;
    }
    testHelpers.testUndefined(err, (loggedInUser && loggedInUser.constructor.name) + " does not error");
  }

  function testWatchIsSad(loggedInUser) {
    var err;
    try {
      callWatch(loggedInUser);
    } catch(e) {
      err = e;
    }
    ok(err, (typeof loggedInUser === 'boolean' ? loggedInUser : loggedInUser.constructor.name) + " is an error");
  }

  function watch(obj) {
    try {
      navigator.id.watch(obj);
      return true;
    } catch (e) {
      return false;
    }
  }

  function callWatch(loggedInUser) {
    navigator.id.watch({
      loggedInUser: loggedInUser,
      onlogin: noOp,
      onlogout: noOp
    });
  }


}());

