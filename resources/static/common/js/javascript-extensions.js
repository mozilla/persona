/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  "use strict";

  if (!Function.prototype.bind) {

    Function.prototype.bind = function (oThis) {

      if (typeof this !== "function") // closest thing possible to the ECMAScript 5 internal IsCallable function
        throw new TypeError("Function.prototype.bind - what is trying to be fBound is not callable");

      var aArgs = Array.prototype.slice.call(arguments, 1),
      fToBind = this,
      FNOP = function () {},
      fBound = function () {
        return fToBind.apply(this instanceof FNOP ? this : oThis || window, aArgs.concat(Array.prototype.slice.call(arguments)));
      };

      FNOP.prototype = this.prototype;
      fBound.prototype = new FNOP();

      return fBound;

    };

  }

  // See http://ejohn.org/blog/partial-functions-in-javascript/
  if(!Function.prototype.curry) {
    Function.prototype.curry = function() {
      var fn = this, args = Array.prototype.slice.call(arguments);
      return function() {
        return fn.apply(this, args.concat(
          Array.prototype.slice.call(arguments)));
      };
    };
  }

  if (!window.console) {
    window.console = {};
  }

  if (!window.console.log) {
    window.console.log = function() {};
  }

  if (!String.prototype.trim) {
    String.prototype.trim = function () {
      return this.replace(/^\s+|\s+$/g,'');
    };
  }

}());
