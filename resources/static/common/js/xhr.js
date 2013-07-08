/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.XHR = (function() {
  "use strict";

  var bid = BrowserID,
      mediator = bid.Mediator,
      transport = bid.XHRTransport,
      BROWSERID_VERSION = BrowserID.CODE_VERSION,
      context,
      csrf_token,
      time_until_delay,
      outstandingRequests = {};

  /**
   * Abort any outstanding XHR requests if the user browses away or reloads.
   * This prevents the onlogout message from being sent if XHR requests fail
   * because the user browses away from the current page.
   * See issue #2423.
   *
   * Note, we are using low level event handler functions here so that the
   * entire DOM module does not have to be included into the
   * communication_iframe.
   */
  if (window.addEventListener) {
    window.addEventListener("beforeunload", abortAll, false);
  } else if (window.attachEvent) {
    window.attachEvent("onbeforeunload", abortAll);
  }

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
    outstandingRequests[reqInfo.eventTime] = null;
    delete outstandingRequests[reqInfo.eventTime];

    reqInfo.duration = new Date() - reqInfo.eventTime;
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
          },
          eventTime: new Date()
        },
        success = function(resp, jqXHR, textResponse) {
          if(delayTimeout) {
            clearTimeout(delayTimeout);
            delayTimeout = null;
          }

          reqInfo.resp = resp;
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

          reqInfo.resp = resp;
          xhrComplete(reqInfo);

          /**
           * XHR request was aborted. Don't do anything. A request can be
           * aborted when:
           * 1. user shuts the dialog while an XHR request is in flight
           * 2. user browses away from an RP while an XHR request in the
           *        communication_iframe is in flight.
           * We cannot prevent these from happening, we can only abort XHR
           * requests when it does happen and clean up afterwards.
           * See issues #3618, #2423, #2560.
           *
           * We differentiate aborted requests from other errors because
           * a status code of 0 can be returned for other XHR issues like
           * illegal cross domain requests or when the user has no
           * connectivity.
           */
          if (resp.statusText === "aborted") return;
          _.defer(xhrError.curry(errorCB, reqInfo, resp, jqXHR, textResponse));
        };

    var req = _.extend({}, options, {
      success: success,
      error: error,
      headers: {
        'BrowserID-git-sha': BROWSERID_VERSION
      }
    });

    if(time_until_delay) {
      delayTimeout = setTimeout(xhrDelay.curry(reqInfo), time_until_delay);
    }

    mediator.publish("xhr_start", reqInfo);
    var xhrObj = transport.ajax(req);
    outstandingRequests[reqInfo.eventTime] = xhrObj;
    return xhrObj;
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

  function abortAll() {
    for (var eventTime in outstandingRequests) {
      outstandingRequests[eventTime].abort();
    }
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
    clearContext: clearContext,

    /**
     * Abort all outstanding XHR requests
     * @method abortAll
     */
    abortAll: abortAll
  };
}());

