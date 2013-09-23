/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This mocks the http/https module for testing.
 */

const EventEmitter = require('events').EventEmitter;
const util = require('util');

function HttpMock(responseOptions) {
  this.responseOptions = responseOptions;
}
HttpMock.prototype.request = function(requestOptions) {
  this._request = new RequestMock(requestOptions, this.responseOptions);
  return this._request;
};

HttpMock.prototype.getRequest = function() {
  return this._request;
};

module.exports = HttpMock;

function RequestMock(requestOptions, responseOptions) {
  this.requestOptions = requestOptions;
  this.responseOptions = responseOptions;
}
util.inherits(RequestMock, EventEmitter);

RequestMock.prototype.write = function(data) {
  this.data = data;
};


RequestMock.prototype.end = function() {
  this.emit('response', {
    statusCode: this.responseOptions.statusCode
  });
};


