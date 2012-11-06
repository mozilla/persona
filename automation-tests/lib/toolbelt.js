/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Create a copy of the process environment and extend it with extra variables
 */
exports.copyExtendEnv = function() {
  var nowEnv = exports.deepCopy(process.env);
  var extensions = [].slice.call(arguments, 0);
  var args = [ nowEnv ].concat(extensions);

  var newEnv = exports.extend.apply(null, args);
  return newEnv;
};

/**
 * Create a deep copy of an object
 */
exports.deepCopy = function(obj) {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Extend an object. The first parameter is the object to extend, parameter 2+
 * are the mixins.
 */
exports.extend = function() {
  var extended = arguments[0];
  var extensions = Array.prototype.slice.call(arguments, 1);
  extensions.forEach(function(extension) {
    for (var key in extension) {
      if (typeof extension[key] !== "undefined") {
        extended[key] = extension[key];
      }
    }
  });

  return extended;
};

