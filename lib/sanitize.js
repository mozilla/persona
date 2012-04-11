/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// a teensy tinsy module to do parameter sanitization.  A good candiate for future
// librification.
//
// usage:
//
//   const sanitize = require('sanitize');
//
//   sanitize(value).isEmail();
//   sanitize(value).isDomain();

// XXX - should review these simple regexps

var logger = require('./logging.js').logger;

module.exports = function (value) {
  var isEmail = function() {
    
    if (!value.toLowerCase().match(/^[\w.!#$%&'*+\-/=?\^`{|}~]+@[a-z\d-]+(\.[a-z\d-]+)+$/i))
      throw "not a valid email";
  };

  var isDomain = function() {
    if (!value.match(/^[a-z\d-]+(\.[a-z\d-]+)+$/i)) {
      throw "not a valid domain";      
    }
  };

  var isOrigin = function() {
    // allow single hostnames, e.g. localhost
    if (!value.match(/^https?:\/\/[a-z\d-]+(\.[a-z\d-]+)*(:\d+)?$/i)) {
      throw "not a valid origin";      
    }
  };

  return {
    isEmail: isEmail,
    isDomain: isDomain,
    isOrigin: isOrigin
  };
};
