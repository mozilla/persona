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
     * @param {object} config
     *   {string} config.url
     *   {string} [config.type]
     *   {object} [config.data]
     *   {function} [config.success]
     *   {function} [config.error]
     * @returns {object} xhr object
     */
    request: makeRequest,

    /**
     * GET request
     * @method get
     * @param {object} config
     *   {string} config.url
     *   {object} [config.data]
     *   {function} [config.success]
     *   {function} [config.error]
     * @returns {object} xhr object
     */
    get: get,

    /**
     * POST request
     * @method post
     * @param {object} config
     *   {string} config.url
     *   {object} config.data
     *   {string} config.data.csrf
     *   {function} [config.success]
     *   {function} [config.error]
     * @returns {object} xhr object
     */
    post: post,

    /**
     * Abort all outstanding XHR requests
     * @method abortAll
     */
    abortAll: abortAll
  });

  sc = XHR.sc;

  return XHR;

  function init(config) {
    /*jshint validthis: true*/
    config = config || {};

    var self = this;

    self.outstandingRequests = {};
    self.outstandingTimers = [];
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
    var self = this;

    // abort all requests
    self.abortAll();

    var abortAllListener = self.abortAllListener;
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
      var timer = request.slowRequestTimeout = setTimeout(function() {
        removeTimer.call(self, timer);
        onXHRResponseDelayed.call(self, request);
      }, self.time_until_delay);
      addTimer.call(self, timer);
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
    options = _.extend(options, {
      type: "GET",
      defer_success: true
    });
    return this.request(options);
  }

  function post(options) {
    /*jshint validthis: true*/
    var data = options.data || {};

    options = _.extend(options, {
      type: "POST",
      data: JSON.stringify(data),
      contentType: 'application/json',
      processData: false,
      defer_success: true
    });

    // let no POST requests fly without a CSRF token.
    if (!data.csrf) {
      var request = getRequestInfo(options);
      return onXHRError.call(this, request, null, null,
                  "missing csrf token from POST request");
    }

    return this.request(options);
  }

  function abortAll() {
    /*jshint validthis: true*/
    var self = this;
    var outstandingRequests = self.outstandingRequests;
    for (var eventTime in outstandingRequests) {
      outstandingRequests[eventTime].xhr.abort();
      outstandingRequests[eventTime] = null;
      delete outstandingRequests[eventTime];
    }

    // abort any outstanding response timers
    var timer;
    while (timer = self.outstandingTimers.pop()) {
      clearTimeout(timer);
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
    var xhr = request.xhr || {};
    errorInfo.network = _.extend(errorInfo.network || {}, {
      status: xhr.status,
      textStatus: textStatus,
      errorThrown: errorThrown,
      responseText: xhr.responseText
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
      var timer = setTimeout(function() {
        removeTimer.call(self, timer);
        complete(request.success, resp, xhrObj, textResponse);
      }, 0);
      addTimer.call(self, timer);
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
    if (xhrObj && xhrObj.statusText === "aborted") return;

    // See note in success about why we defer responses
    var timer = setTimeout(function() {
      removeTimer.call(self, timer);
      var errorInfo = getErrorInfo(request, textStatus, errorThrown);
      self.publish("xhr_error", errorInfo);
      complete(request.error, errorInfo);
    }, 0);

    addTimer.call(self, timer);
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

    var timer = request.slowRequestTimeout;
    if (timer) {
      removeTimer.call(this, timer);
      request.slowRequestTimeout = null;
    }

    request.duration = new Date().getTime() - request.eventTime;
    this.publish("xhr_complete", request);
  }

  // Timers keep track of outstanding setTimeouts that must be cleared on
  // abortAll or when the module stops to prevent interference between tests.
  function removeTimer(timer) {
    /*jshint validthis: true*/
    var self=this;

    // clear the timeout whether it is in the list of outstandingTimers or not.
    clearTimeout(timer);

    var index = _.indexOf(self.outstandingTimers, timer);
    if (index > -1) {
      self.outstandingTimers.splice(index, 1);
    }
  }

  function addTimer(timer) {
    /*jshint validthis: true*/
    this.outstandingTimers.push(timer);
  }


}());

