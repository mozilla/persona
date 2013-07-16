/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This is a slightly higher level XHR abstraction over the low level transport
 * module. It extends the Modules.Module interface and is created using
 * BrowserID.XHR.create();
 */
BrowserID.Modules.XHR = (function() {
  "use strict";

  var bid = BrowserID,
      complete = bid.Helpers.complete,
      XHRTransport = bid.XHRTransport,
      BROWSERID_VERSION = BrowserID.CODE_VERSION,
      sc;

  var XHR = bid.Modules.Module.extend({
    /**
     * Initialize the XHR object.
     * @method init
     * @param {object} config
     *    {object} [config.transport] - XHR transport to use
     *    {number} [config.time_until_delay] - time in ms until a request is
     *                considered delayed.
     */
    init: init,

    /**
     * Stop the module
     * @method stop
     */
    stop: stop,

    /**
     * Low level request
     * @method request
     */
    request: makeRequest,

    /**
     * GET request
     * @method get
     * @param {object} config
     *   {string} config.url
     *   {function} [config.success]
     *   {function} [config.error]
     */
    get: get,

    /**
     * POST request
     * @method post
     * @param {object} config
     *   {string} config.url
     *   {function} [config.success]
     *   {function} [config.error]
     */
    post: post,

    /**
     * Get the session context
     * @method getContext
     * @param {function} complete
     * @param {function} error
     */
    getContext: getContext,

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
  });

  sc = XHR.sc;

  return XHR;

  function clearContext() {
    /*jshint validthis: true*/
    this.context = undefined;
  }

  function init(config) {
    /*jshint validthis: true*/
    config = config || {};

    var self = this;

    self.outstandingRequests = {};
    self.transport = config.transport || XHRTransport;
    self.time_until_delay = config.time_until_delay;

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
    var abortAllListener = self.abortAllListener = abortAll.bind(this);
    if (window.addEventListener) {
      window.addEventListener("beforeunload", abortAllListener, false);
    } else if (window.attachEvent) {
      window.attachEvent("onbeforeunload", abortAllListener);
    }

    sc.init.call(self, config);
  }

  function stop() {
    /*jshint validthis: true*/
    var abortAllListener = this.abortAllListener;
    if (window.removeEventListener) {
      window.removeEventListener("beforeunload", abortAllListener, false);
    } else if (window.detachEvent) {
      window.detachEvent("onbeforeunload", abortAllListener);
    }

    sc.stop.call(this);
  }

  function makeRequest(options) {
    /*jshint validthis: true*/
    var self = this;

    var request = getRequestInfo(options);
    // The request obj must be added to list of outstanding requests in
    // case request is synchronous. This makes sure all housekeeping is kept in
    // order.
    self.outstandingRequests[request.eventTime] = request;

    /**
     * Start a timer that keeps track of whether the request is taking too
     * long. If the delay timeout occurs, a message is displayed to
     * the user informing them of the slowness.
     */
    if (self.time_until_delay) {
      request.slowRequestTimeout = setTimeout(function() {
        onXHRResponseDelayed.call(self, request);
      }, self.time_until_delay);
    }

    self.publish("xhr_start", request);

    var transportConfig = _.extend({}, options, {
      success: onXHRSuccess.bind(self, request),
      error: onXHRError.bind(self, request),
      headers: {
        'BrowserID-git-sha': BROWSERID_VERSION
      }
    });

    request.xhr = self.transport.ajax(transportConfig);

    return request;
  }

  function get(options) {
    /*jshint validthis: true*/
    var req = _.extend(options, {
      type: "GET",
      defer_success: true
    });
    this.request(req);
  }

  function post(options) {
    /*jshint validthis: true*/
    var self = this;
    self.getContext(function(context) {
      var data = options.data || {};
      data.csrf = data.csrf || context.csrf_token;
      var req = _.extend(options, {
        type: "POST",
        data: JSON.stringify(data),
        contentType: 'application/json',
        processData: false,
        defer_success: true
      });
      self.request(req);
    }, options.error);
  }

  function getContext(done, onFailure) {
    /*jshint validthis: true*/
    var self = this;
    if (typeof self.context !== 'undefined') complete(done, self.context);
    else {
      self.request({
        type: "GET",
        url: "/wsapi/session_context",
        success: function(result) {
          self.context = result;

          self.publish("context_info", result);

          complete(done, result);
        },
        error: onFailure
      });
    }
  }


  function abortAll() {
    /*jshint validthis: true*/
    var outstandingRequests = this.outstandingRequests;
    for (var eventTime in outstandingRequests) {
      outstandingRequests[eventTime].xhr.abort();
      outstandingRequests[eventTime] = null;
      delete outstandingRequests[eventTime];
    }
  }

  function getRequestInfo(options) {
    return _.extend({}, options, {
      network: {
        type: options.type.toUpperCase(),
        url: options.url
      },
      eventTime: new Date().getTime()
    });
  }

  function getErrorInfo(request, textStatus, errorThrown) {
    var errorInfo = _.extend(request || {});
    errorInfo.network = _.extend(errorInfo.network || {}, {
      status: request.xhr.status,
      textStatus: textStatus,
      errorThrown: errorThrown,
      responseText: request.xhr.responseText
    });

    return errorInfo;
  }

  function onXHRSuccess(request, resp, textResponse, xhrObj) {
    /*jshint validthis: true*/
    var self = this;
    xhrComplete.call(self, request);
    // We defer the responses because otherwise the transport eats any
    // exceptions that are thrown in the response handlers and it
    // becomes very difficult to debug.
    if (request.defer_success) {
      setTimeout(function() {
        complete(request.success, resp, xhrObj, textResponse);
      }, 0);
    }
    else {
      request.success(resp, xhrObj, textResponse);
    }
  }

  function onXHRError(request, xhrObj, textStatus, errorThrown) {
    /*jshint validthis: true*/
    var self = this;
    xhrComplete.call(self, request);

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
    if (xhrObj.statusText === "aborted") return;

    // See note in success about why we defer responses
    setTimeout(function() {
      var errorInfo = getErrorInfo(request, textStatus, errorThrown);
      self.publish("xhr_error", errorInfo);
      complete(request.error, errorInfo);
    }, 0);
  }


  function onXHRResponseDelayed(request) {
    /*jshint validthis: true*/
    this.publish("xhr_delay", request);
  }

  function xhrComplete(request) {
    /*jshint validthis: true*/
    var outstandingRequests = this.outstandingRequests;
    outstandingRequests[request.eventTime] = null;
    delete outstandingRequests[request.eventTime];

    if (request.slowRequestTimeout) {
      clearTimeout(request.slowRequestTimeout);
      request.slowRequestTimeout = null;
    }

    request.duration = new Date().getTime() - request.eventTime;
    this.publish("xhr_complete", request);
  }


}());

