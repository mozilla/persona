/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * The most base level features that everything else depends on while
 * booting up the service
 */

var handleUncaughtException = function (err) {
  console.error('UNCLE:', err.stack || err);
};

exports.addExceptionHandler = function () {
  process.addListener('uncaughtException', handleUncaughtException);
};

exports.removeExceptionHandler = function () {
  process.removeListener('uncaughtException', handleUncaughtException);
};