;WinChan = (function() {
  var IFRAME_NAME = "_moz_vep_comm_iframe";

  // a portable addListener implementation
  function addListener(w, event, cb) {
    if(w.attachEvent) w.attachEvent('on' + event, cb);
    else if (w.addEventListener) w.addEventListener(event, cb, false);
  }

  // a portable removeListener implementation
  function removeListener(w, event, cb) {
    if(w.detachEvent) w.detachEvent('on' + event, cb);
    else if (w.removeEventListener) w.removeEventListener(event, cb, false);
  }

  // checking for IE8 or above
  function isInternetExplorer() {
    var rv = -1; // Return value assumes failure.
    if (navigator.appName == 'Microsoft Internet Explorer') {
      var ua = navigator.userAgent;
      var re = new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})");
      if (re.exec(ua) != null)
        rv = parseFloat(RegExp.$1);
    }
    return rv >= 8;
  }

  // checking Mobile Firefox (Fennec)
  function isFennec() {
    try {
      return (navigator.userAgent.indexOf('Fennec/') != -1);
    } catch(e) {};
    return false;
  }

  // feature checking to see if this platform is supported at all
  function isSupported() {
    return (window.JSON && window.JSON.stringify &&
            window.JSON.parse && window.postMessage);
  }

  // given a URL, extract the origin
  function extractOrigin(url) {
    var m = /^(https?:\/\/[-_a-zA-Z\.0-9:]+)/.exec(url);
    if (m) return m[1];
    return url;
  }

  if (isInternetExplorer()) {
    // find the relay iframe in the opener
    function findRelay() {
      var loc = window.location;
      var frames = window.opener.frames;
      var origin = loc.protocol + '//' + loc.host;
      for (i = frames.length - 1; i >= 0; i++) {
        try {
          if (frames[i].location.href.indexOf(origin) === 0 &&
              frames[i].name === IFRAME_NAME)
          {
            return frames[i];
          }
        } catch(e) { }
      }
      return;
    }

    /*  This is how we roll on IE:
     *  0. user clicks
     *  1. caller adds relay iframe (served from trusted domain) to DOM
     *  2. caller opens window (with content from trusted domain)
     *  3. window on opening adds a listener to 'message'
     *  4. window on opening finds iframe
     *  5. window checks if iframe is "loaded" - has a 'doPost' function yet
     *  5a. if iframe.doPost exists, window uses it to send ready event to caller
     *  5b. if iframe.doPost doesn't exist, window waits for frame ready
     *   5bi. once ready, window calls iframe.doPost to send ready event
     *  6. caller upon reciept of 'ready', sends args
     */
    return {
      open: function(url, relay_url, winopts, arg, cb) {
        if (!cb) throw "missing required callback argument";

        // sanity check, are url and relay_url the same origin? 
        var origin = extractOrigin(url);
        if (origin !== extractOrigin(relay_url)) {
          setTimeout(function() {
            cb('invalid arguments: origin of url and relay_url must match');
          })
          return;
        }

        // first we need to add a "relay" iframe to the document that's served
        // from the target domain.  We can postmessage into a iframe, but not a
        // window
        var iframe = document.createElement("iframe");
        // iframe.setAttribute('name', framename);
        iframe.setAttribute('src', relay_url);
        iframe.style.display = "none";
        iframe.setAttribute('name', IFRAME_NAME);
        document.body.appendChild(iframe);

        var w = window.open(url, null, winopts); 
        var req = JSON.stringify({a: 'request', d: arg});

        // cleanup on unload
        function cleanup() {
          document.body.removeChild(iframe);
          if (w) w.close();
          w = undefined;
        }

        addListener(window, 'unload', cleanup);

        function onMessage(e) {
          try {
            var d = JSON.parse(e.data);
            if (d.a === 'ready') iframe.contentWindow.postMessage(req, origin);
            else if (d.a === 'error') cb(d.d);
            else if (d.a === 'response') {
              removeListener(window, 'message', onMessage);
              removeListener(window, 'unload', cleanup);
              cleanup();
              cb(null, d.d);
            }
          } catch(e) { }
        };

        addListener(window, 'message', onMessage);

        return {
          close: function() {
            if (w) w.close();
            w = undefined;
          },
          focus: function() {
            if (w) w.focus();
          }
        };
      },
      onOpen: function(cb) {
        var o = "*";
        var theFrame = findRelay();
        if (!theFrame) throw "can't find relay frame";

        function onMessage(e) {
          var d;
          o = e.origin;
          try {
            d = JSON.parse(e.data);
          } catch(e) { }
          if (cb) cb(o, d.d, function(r) {
            cb = undefined;
            theFrame.doPost(JSON.stringify({a: 'response', d: r}), o);
          });
        }
        addListener(theFrame, 'message', onMessage);

        // we cannot post to our parent that we're ready before the iframe
        // is loaded.
        try {
          theFrame.doPost('{"a": "ready"}', o);
        } catch(e) {
          addListener(theFrame, 'load', function(e) {
            theFrame.doPost('{"a": "ready"}', o);
          });
        }

        // if window is unloaded and the client hasn't called cb, it's an error
        addListener(window, 'unload', function() {
          if (cb) theFrame.doPost(JSON.stringify({
            a: 'error', d: 'client closed window'
          }), o);
          cb = undefined;
          // explicitly close the window, in case the client is trying to reload or nav
          try { window.close(); } catch (e) { };
        });
      }
    };
  } else if (isSupported()) {
    return {
      open: function(url, relay_url, winopts, arg, cb) {
        if (!cb) throw "missing required callback argument";

        // sanity check, are url and relay_url the same origin? 
        var origin = extractOrigin(url);
        if (origin !== extractOrigin(relay_url)) {
          setTimeout(function() {
            cb('invalid arguments: origin of url and relay_url must match');
          })
          return;
        }

        var w = window.open(url, null, isFennec() ? undefined : winopts);
        var req = JSON.stringify({a: 'request', d: arg});

        // cleanup on unload
        function cleanup() {
          if (w) w.close();
          w = undefined;
        }
        addListener(window, 'unload', cleanup);

        function onMessage(e) {
          try {
            var d = JSON.parse(e.data);
            if (d.a === 'ready') w.postMessage(req, origin);
            else if (d.a === 'error') cb(d.d);
            else if (d.a === 'response') {
              removeListener(window, 'message', onMessage);
              removeListener(window, 'unload', cleanup);
              cleanup();
              cb(null, d.d);
            }
          } catch(e) { }
        }
        addListener(window, 'message', onMessage);

        return {
          close: function() {
            if (w) w.close();
            w = undefined;
          },
          focus: function() {
            if (w) w.focus();
          }
        };
      },
      onOpen: function(cb) {
        var o = "*";
        var parentWin = window.opener;
        function onMessage(e) {
          var d;
          o = e.origin;
          try {
            d = JSON.parse(e.data);
          } catch(e) {
            // ignore
          }
          cb(o, d.d, function(r) {
            cb = undefined;
            parentWin.postMessage(JSON.stringify({a: 'response', d: r}), o);
          });
        }
        addListener(window, 'message', onMessage);
        parentWin.postMessage('{"a": "ready"}', o);

        // if window is unloaded and the client hasn't called cb, it's an error
        addListener(window, 'unload', function() {
          if (cb) parentWin.postMessage(JSON.stringify({
            a: 'error',
            d: 'client closed window'
          }), o);
          cb = undefined;
          // explicitly close the window, in case the client is trying to reload or nav
          try { window.close(); } catch (e) { };
        });
      }
    };
  } else {
    return {
      open: function(url, winopts, arg, cb) {
        setTimeout(function() { cb("unsupported browser"); }, 0);
      },
      onOpen: function(cb) {
        setTimeout(function() { cb("unsupported browser"); }, 0);
      }
    };
  }
})();
