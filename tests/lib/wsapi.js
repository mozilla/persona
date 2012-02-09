/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
wcli = require('../../lib/wsapi_client');

// the client "context"
var context = {};

// the configuration
var configuration = {
  browserid: 'http://127.0.0.1:10002/'
}

exports.clearCookies = function() {
  wcli.clearCookies(context);
};

exports.injectCookies = function(cookies) {
  wcli.injectCookies({cookieJar: cookies}, context);
};

exports.get = function (path, getArgs) {
  return function () {
    wcli.get(configuration, path, context, getArgs, this.callback);
  };
};

exports.post = function (path, postArgs) {
  return function () {
    wcli.post(configuration, path, context, postArgs, this.callback);
  };
};

exports.getCSRF = function() {
  if (context && context.session && context.session.csrf_token) {
    return context.session.csrf_token;
  }
  return null;
};