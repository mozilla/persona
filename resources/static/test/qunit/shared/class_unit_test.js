/*jshint browsers:true, forin: true, laxbreak: true */
/*global steal: true, test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID: true */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla BrowserID.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
steal.then(function() {
  module("shared/class", {
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

});
