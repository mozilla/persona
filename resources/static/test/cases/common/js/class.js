/*jshint browser: true, forin: true, laxbreak: true */
/*global test: true, start: true, module: true, ok: true, equal: true, BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  module("common/js/class", {
  });

  test("create a class with no superclass", function() {
    var Class = BrowserID.Class({
      constructor: function() {
        this.constRun = true;
      },

      init: function(config) {
        this.val = true;
      },

      getVal: function() {
        return this.val;
      }
    });

    equal(typeof Class, "function", "Class created");
    equal(typeof Class.sc, "undefined", "no superclass");

    var inst = Class.create();
    ok(inst instanceof Class, "instance created");
    equal(inst.constRun, true, "constructor was run");
    equal(inst.getVal(), true, "init was run, getVal correctly added");
  });

  test("create a class with a superclass", function() {
    var Sup = BrowserID.Class({
      init: function() { },

      val: true,
      getVal: function() {
        return this.val;
      },

      anotherVal: 3,
      getAnotherVal: function() {
        return this.anotherVal;
      }
    });

    var Sub = BrowserID.Class(Sup, {
      val2: false,
      getVal2: function() {
        return this.val2;
      },

      getAnotherVal: function() {
        return Sub.sc.getAnotherVal.call(this) + 1;
      }
    });

    strictEqual(Sub.sc, Sup.prototype, "Sub classes superclass points to Sup.prototype");
    var inst = Sub.create();

    equal(inst.getVal(), true, "superclass function added");
    equal(inst.getVal2(), false, "sublcass function added");
    equal(inst.getAnotherVal(), 4, "overridden function works properly");
  });

  test("Class.extend", function() {
    var Sup = BrowserID.Class({
      init: function() { },

      val: true,
      getVal: function() {
        return this.val;
      },

      anotherVal: 3,
      getAnotherVal: function() {
        return this.anotherVal;
      }
    });

    var Sub = Sup.extend({
      val2: false,
      getVal2: function() {
        return this.val2;
      },

      getAnotherVal: function() {
        return Sub.sc.getAnotherVal.call(this) + 1;
      }
    });

    strictEqual(Sub.sc, Sup.prototype, "Sub classes superclass points to Sup.prototype");
    var inst = Sub.create();

    equal(inst.getVal(), true, "superclass function added");
    equal(inst.getVal2(), false, "sublcass function added");
    equal(inst.getAnotherVal(), 4, "overridden function works properly");

  });

}());
