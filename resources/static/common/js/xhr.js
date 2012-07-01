/*jshint browser: true, forin: true, laxbreak: true */
/*global BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.XHR = (function() {
  "use strict";

  var bid = BrowserID,
      mediator = bid.Mediator,
      context,
      csrf_token,
      transport = bid.XHRTransport,
      time_until_delay;

  function clearContext() {
    csrf_token = context = undefined;
  }

  function init(config) {
    if(config.hasOwnProperty("transport")) {
      transport = config.transport;
    }

    if(config.hasOwnProperty("time_until_delay")) {
      time_until_delay = config.time_until_delay;
    }

    clearContext();
  }

  function xhrError(cb, info, jqXHR, textStatus, errorThrown) {
    info = info || {};
    info.network = _.extend(info.network || {}, {
      status: jqXHR && jqXHR.status,
      textStatus: textStatus,
      errorThrown: errorThrown,
      responseText: jqXHR.responseText
    });

    mediator.publish("xhr_error", info);

    if (cb) cb(info);
  }

  function xhrDelay(reqInfo) {
    mediator.publish("xhr_delay", reqInfo);
  }

  function xhrComplete(reqInfo) {
    mediator.publish("xhr_complete", reqInfo);
  }

  function request(options) {
    // We defer the responses because otherwise jQuery eats any exceptions
    // that are thrown in the response handlers and it becomes very difficult
    // to debug.
    var successCB = options.success,
        errorCB = options.error,
        delayTimeout,
        reqInfo = {
          network: {
            type: options.type.toUpperCase(),
            url: options.url
          }
        },
        success = function(resp, jqXHR, textResponse) {
          if(delayTimeout) {
            clearTimeout(delayTimeout);
            delayTimeout = null;
          }

          xhrComplete(reqInfo);
          if(options.defer_success) {
            _.defer(successCB.curry(resp, jqXHR, textResponse));
          }
          else {
            successCB(resp, jqXHR, textResponse);
          }
        },
        error = function(resp, jqXHR, textResponse) {
          if(delayTimeout) {
            clearTimeout(delayTimeout);
            delayTimeout = null;
          }

          xhrComplete(reqInfo);
          _.defer(xhrError.curry(errorCB, reqInfo, resp, jqXHR, textResponse));
        };

    var req = _.extend({}, options, {
      success: success,
      error: error
    });

    if(time_until_delay) {
      delayTimeout = setTimeout(xhrDelay.curry(reqInfo), time_until_delay);
    }

    mediator.publish("xhr_start", reqInfo);
    transport.ajax(req);
  }

  function get(options) {
    var req = _.extend(options, {
      type: "GET",
      defer_success: true
    });
    request(req);
  }

  function withContext(cb, onFailure) {
    if (typeof context !== 'undefined') cb(context);
    else {
      request({
        type: "GET",
        url: "/wsapi/session_context",
        success: function(result) {
          csrf_token = result.csrf_token;
          context = result;

          mediator.publish("context_info", result);

          cb && cb(result);
        },
        error: onFailure
      });
    }
  }

  function post(options) {
    withContext(function() {
      var data = options.data || {};
      data.csrf = data.csrf || csrf_token;
      var req = _.extend(options, {
        type: "POST",
        data: JSON.stringify(data),
        contentType: 'application/json',
        processData: false,
        defer_success: true
      });
      request(req);
    }, options.error);
  }


  return {
    /**
     * Initialize the XHR object.
     * @method init
     * @param {object} config
     *    {object} [transport] - XHR transport to use
     *    {number} [time_until_delay] - time until a request is considered
     *    delayed.
     */
    init: init,

    /**
     * GET request
     * @method get
     * @param {object} config
     *   {string} url
     *   {function} [success] - called on success
     *   {function} [error] - called on XHR failure
     */
    get: get,

    /**
     * POST request
     * @method post
     * @param {object} config
     *   {string} url
     *   {function} [success] - called on success
     *   {function} [error] - called on XHR failure
     */
    post: post,

    /**
     * Get the session context
     * @method withContext
     * @param {function} complete
     * @param {function} error - called on XHR failure
     */
    withContext: withContext,

    /**
     * Clear the current context
     * @method clearContext
     */
    clearContext: clearContext
  };
}());

