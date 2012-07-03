/*jshint browser:true, forin: true, laxbreak: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
window.Micrajax = (function() {
  "use strict";

  function curry(fToBind) {
    var aArgs = [].slice.call(arguments, 1),
        fBound = function () {
          return fToBind.apply(null, aArgs.concat([].slice.call(arguments)));
        };

    return fBound;
  }

  function getXHRObject() {
    var xhrObject;

    // From  http://blogs.msdn.com/b/ie/archive/2011/08/31/browsing-without-plug-ins.aspx
    // Best Practice: Use Native XHR, if available
    if (window.XMLHttpRequest) {
      // If IE7+, Gecko, WebKit: Use native object
      xhrObject = new XMLHttpRequest();
    }
    else if (window.ActiveXObject) {
      // ...if not, try the ActiveX control
      xhrObject = new ActiveXObject('Microsoft.XM/LHTTP');
    }

    return xhrObject;
  }

  function noOp() {}

  function onReadyStateChange(xhrObject, callback) {
    try {
      if (xhrObject.readyState == 4) {
        xhrObject.onreadystatechange = noOp;

        callback && callback(xhrObject.responseText, xhrObject.status);
      }
    } catch(e) {}
  }

  function toRequestString(data) {
    var components = [],
        requestString = "";

    for(var key in data) {
      if (typeof data[key] !== "undefined") {
        components.push(encodeURIComponent(key) + "=" + encodeURIComponent(data[key]));
      }
    }

    if (components && components.length) {
      requestString = components.join("&");
    }

    return requestString;
  }


  function setRequestHeaders(definedHeaders, xhrObject) {
    var headers = {
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json;text/plain'
    };

    for(var key in definedHeaders) {
      headers[key] = definedHeaders[key];
    }

    for(var key in headers) {
      xhrObject.setRequestHeader(key, headers[key]);
    }
  }

  function getURL(url, type, data) {
    var requestString = toRequestString(data);

    if (type === "GET" && requestString) {
      url += "?" + requestString;
    }

    return url;
  }

  function getData(contentType, type, data) {
    var sendData;

    if (type !== "GET" && data) {
      switch(contentType) {
        case "application/json":
          if(typeof data === "string") {
            sendData = data;
          }
          else {
            sendData = JSON.stringify(data);
          }
          break;
        case 'application/x-www-form-urlencoded':
          sendData = toRequestString(data);
          break;
        default:
          // do nothing
          break;
      }
    }

    return sendData || null;
  }

  function sendRequest(options, callback, data) {
    var xhrObject = getXHRObject();

    if (xhrObject) {
      xhrObject.onreadystatechange = curry(onReadyStateChange, xhrObject, callback);

      var type = (options.type || "GET").toUpperCase(),
          contentType = options.contentType || 'application/x-www-form-urlencoded',
          url = getURL(options.url, type, options.data),
          data = getData(contentType, type, options.data);

      xhrObject.open(type, url, true);
      setRequestHeaders({ "Content-type" : contentType }, xhrObject);
      xhrObject.send(data);
    }
    else {
      throw "could not get XHR object";
    }
  }

  var Micrajax = {
    ajax: function(options) {
      var error = options.error,
          success = options.success,
          mockXHR = { readyState: 0 };

      sendRequest(options, function(responseText, status) {
        mockXHR.status = status;
        mockXHR.responseText = responseText;
        mockXHR.readyState = 4;

        if (status >= 200 && status < 300 || status === 304) {
          var respData = responseText;

          try {
            // The text response could be text/plain, just ignore the JSON
            // parse error in this case.
            var respData = JSON.parse(responseText);
          } catch(e) {}

          success && success(respData, responseText, mockXHR);
        }
        else {
          error && error(mockXHR, status, responseText);
        }
      });

      return mockXHR;
    }
  };

  return Micrajax;

}());
