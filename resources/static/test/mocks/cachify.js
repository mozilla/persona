/*jshint browser: true, forin: true, laxbreak: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
window.cachify = (function() {
  "use strict";

  // cachify is a node module used for caching resources, as such it is not
  // available to the client. The main site makes use of cachify in its
  // templates to serve up cached resources.  The front end unit tests write
  // the main site templates to the DOM to run.  Create a mock cachify so the
  // front end unit tests can run.
  return function(url) { return url; }
}());

