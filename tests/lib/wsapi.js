/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
wcli = require('../../lib/wsapi_client');

// the client "context"
var context = exports.context = {};

// the configuration
var configuration = exports.configuration = {
  browserid: 'http://127.0.0.1:10002/'
};

exports.clearCookies = function(ctx) {
  wcli.clearCookies(ctx||context);
};

exports.injectCookies = function(cookies, ctx) {
  wcli.injectCookies({cookieJar: cookies}, ctx||context);
};

exports.getCookie = function(which, ctx) {
  return wcli.getCookie(ctx||context, which);
};

exports.get = function (path, getArgs, ctx, done) {
  return function () {
    wcli.get(configuration, path, ctx||context, getArgs, (done || this.callback).bind(this));
  };
};

exports.post = function (path, postArgs, ctx, done) {
  return function () {
    wcli.post(configuration, path, ctx||context, postArgs, (done || this.callback).bind(this));
  };
};

exports.getCSRF = function(ctx) {
  var context = ctx||context;
  if (context && context.session && context.session.csrf_token) {
    return context.session.csrf_token;
  }
  return null;
};

// allows for multiple clients
exports.setContext = function (cxt) {
  context = cxt;
};

exports.getContext = function () {
  return context;
};
