/**
 * Uncompressed source can be found at https://login.persona.org/include.orig.js
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  // this is the file that the RP includes to shim in the
  // navigator.id.getVerifiedEmail() function
  //  "use strict";

  // local embedded copy of jschannel: http://github.com/mozilla/jschannel
  /**
   * js_channel is a very lightweight abstraction on top of
   * postMessage which defines message formats and semantics
   * to support interactions more rich than just message passing
   * js_channel supports:
   *  + query/response - traditional rpc
   *  + query/update/response - incremental async return of results
   *    to a query
   *  + notifications - fire and forget
   *  + error handling
   *
   * js_channel is based heavily on json-rpc, but is focused at the
   * problem of inter-iframe RPC.
   *
   * Message types:
   *  There are 5 types of messages that can flow over this channel,
   *  and you may determine what type of message an object is by
   *  examining its parameters:
   *  1. Requests
   *    + integer id
   *    + string method
   *    + (optional) any params
   *  2. Callback Invocations (or just "Callbacks")
   *    + integer id
   *    + string callback
   *    + (optional) params
   *  3. Error Responses (or just "Errors)
   *    + integer id
   *    + string error
   *    + (optional) string message
   *  4. Responses
   *    + integer id
   *    + (optional) any result
   *  5. Notifications
   *    + string method
   *    + (optional) any params
   */
  var Channel = (function() {
    "use strict";

    // current transaction id, start out at a random *odd* number between 1 and a million
    // There is one current transaction counter id per page, and it's shared between
    // channel instances.  That means of all messages posted from a single javascript
    // evaluation context, we'll never have two with the same id.
    var s_curTranId = Math.floor(Math.random()*1000001);

    // no two bound channels in the same javascript evaluation context may have the same origin, scope, and window.
    // futher if two bound channels have the same window and scope, they may not have *overlapping* origins
    // (either one or both support '*').  This restriction allows a single onMessage handler to efficiently
    // route messages based on origin and scope.  The s_boundChans maps origins to scopes, to message
    // handlers.  Request and Notification messages are routed using this table.
    // Finally, channels are inserted into this table when built, and removed when destroyed.
    var s_boundChans = { };

    // add a channel to s_boundChans, throwing if a dup exists
    function s_addBoundChan(win, origin, scope, handler) {
      function hasWin(arr) {
        for (var i = 0; i < arr.length; i++) if (arr[i].win === win) return true;
        return false;
      }

      // does she exist?
      var exists = false;


      if (origin === '*') {
        // we must check all other origins, sadly.
        for (var k in s_boundChans) {
          if (!s_boundChans.hasOwnProperty(k)) continue;
          if (k === '*') continue;
          if (typeof s_boundChans[k][scope] === 'object') {
            exists = hasWin(s_boundChans[k][scope]);
            if (exists) break;
          }
        }
      } else {
        // we must check only '*'
        if ((s_boundChans['*'] && s_boundChans['*'][scope])) {
          exists = hasWin(s_boundChans['*'][scope]);
        }
        if (!exists && s_boundChans[origin] && s_boundChans[origin][scope])
        {
          exists = hasWin(s_boundChans[origin][scope]);
        }
      }
      if (exists) throw "A channel is already bound to the same window which overlaps with origin '"+ origin +"' and has scope '"+scope+"'";

      if (typeof s_boundChans[origin] != 'object') s_boundChans[origin] = { };
      if (typeof s_boundChans[origin][scope] != 'object') s_boundChans[origin][scope] = [ ];
      s_boundChans[origin][scope].push({win: win, handler: handler});
    }

    function s_removeBoundChan(win, origin, scope) {
      var arr = s_boundChans[origin][scope];
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].win === win) {
          arr.splice(i,1);
        }
      }
      if (s_boundChans[origin][scope].length === 0) {
        delete s_boundChans[origin][scope];
      }
    }

    function s_isArray(obj) {
      if (Array.isArray) return Array.isArray(obj);
      else {
        return (obj.constructor.toString().indexOf("Array") != -1);
      }
    }

    // No two outstanding outbound messages may have the same id, period.  Given that, a single table
    // mapping "transaction ids" to message handlers, allows efficient routing of Callback, Error, and
    // Response messages.  Entries are added to this table when requests are sent, and removed when
    // responses are received.
    var s_transIds = { };

    // class singleton onMessage handler
    // this function is registered once and all incoming messages route through here.  This
    // arrangement allows certain efficiencies, message data is only parsed once and dispatch
    // is more efficient, especially for large numbers of simultaneous channels.
    var s_onMessage = function(e) {
      try {
        var m = JSON.parse(e.data);
        if (typeof m !== 'object' || m === null) throw "malformed";
      } catch(e) {
        // just ignore any posted messages that do not consist of valid JSON
        return;
      }

      var w = e.source;
      var o = e.origin;
      var s, i, meth;

      if (typeof m.method === 'string') {
        var ar = m.method.split('::');
        if (ar.length == 2) {
          s = ar[0];
          meth = ar[1];
        } else {
          meth = m.method;
        }
      }

      if (typeof m.id !== 'undefined') i = m.id;

      // w is message source window
      // o is message origin
      // m is parsed message
      // s is message scope
      // i is message id (or undefined)
      // meth is unscoped method name
      // ^^ based on these factors we can route the message

      // if it has a method it's either a notification or a request,
      // route using s_boundChans
      if (typeof meth === 'string') {
        var delivered = false;
        if (s_boundChans[o] && s_boundChans[o][s]) {
          for (var j = 0; j < s_boundChans[o][s].length; j++) {
            if (s_boundChans[o][s][j].win === w) {
              s_boundChans[o][s][j].handler(o, meth, m);
              delivered = true;
              break;
            }
          }
        }

        if (!delivered && s_boundChans['*'] && s_boundChans['*'][s]) {
          for (var j = 0; j < s_boundChans['*'][s].length; j++) {
            if (s_boundChans['*'][s][j].win === w) {
              s_boundChans['*'][s][j].handler(o, meth, m);
              break;
            }
          }
        }
      }
      // otherwise it must have an id (or be poorly formed
      else if (typeof i != 'undefined') {
        if (s_transIds[i]) s_transIds[i](o, meth, m);
      }
    };

    // Setup postMessage event listeners
    if (window.addEventListener) window.addEventListener('message', s_onMessage, false);
    else if(window.attachEvent) window.attachEvent('onmessage', s_onMessage);

    /* a messaging channel is constructed from a window and an origin.
     * the channel will assert that all messages received over the
     * channel match the origin
     *
     * Arguments to Channel.build(cfg):
     *
     *   cfg.window - the remote window with which we'll communicate
     *   cfg.origin - the expected origin of the remote window, may be '*'
     *                which matches any origin
     *   cfg.scope  - the 'scope' of messages.  a scope string that is
     *                prepended to message names.  local and remote endpoints
     *                of a single channel must agree upon scope. Scope may
     *                not contain double colons ('::').
     *   cfg.debugOutput - A boolean value.  If true and window.console.log is
     *                a function, then debug strings will be emitted to that
     *                function.
     *   cfg.debugOutput - A boolean value.  If true and window.console.log is
     *                a function, then debug strings will be emitted to that
     *                function.
     *   cfg.postMessageObserver - A function that will be passed two arguments,
     *                an origin and a message.  It will be passed these immediately
     *                before messages are posted.
     *   cfg.gotMessageObserver - A function that will be passed two arguments,
     *                an origin and a message.  It will be passed these arguments
     *                immediately after they pass scope and origin checks, but before
     *                they are processed.
     *   cfg.onReady - A function that will be invoked when a channel becomes "ready",
     *                this occurs once both sides of the channel have been
     *                instantiated and an application level handshake is exchanged.
     *                the onReady function will be passed a single argument which is
     *                the channel object that was returned from build().
     */
    return {
      build: function(cfg) {
        var debug = function(m) {
          if (cfg.debugOutput && window.console && window.console.log) {
            // try to stringify, if it doesn't work we'll let javascript's built in toString do its magic
            try { if (typeof m !== 'string') m = JSON.stringify(m); } catch(e) { }
            console.log("["+chanId+"] " + m);
          }
        };

        /* browser capabilities check */
        if (!window.postMessage) throw("jschannel cannot run this browser, no postMessage");
        if (!window.JSON || !window.JSON.stringify || ! window.JSON.parse) {
          throw("jschannel cannot run this browser, no JSON parsing/serialization");
        }

        /* basic argument validation */
        if (typeof cfg != 'object') throw("Channel build invoked without a proper object argument");

        if (!cfg.window || !cfg.window.postMessage) throw("Channel.build() called without a valid window argument");

        /* we'd have to do a little more work to be able to run multiple channels that intercommunicate the same
         * window...  Not sure if we care to support that */
        if (window === cfg.window) throw("target window is same as present window -- not allowed");

        // let's require that the client specify an origin.  if we just assume '*' we'll be
        // propagating unsafe practices.  that would be lame.
        var validOrigin = false;
        if (typeof cfg.origin === 'string') {
          var oMatch;
          if (cfg.origin === "*") validOrigin = true;
          // allow valid domains under http and https.  Also, trim paths off otherwise valid origins.
          else if (null !== (oMatch = cfg.origin.match(/^https?:\/\/(?:[-a-zA-Z0-9_\.])+(?::\d+)?/))) {
            cfg.origin = oMatch[0].toLowerCase();
            validOrigin = true;
          }
        }

        if (!validOrigin) throw ("Channel.build() called with an invalid origin");

        if (typeof cfg.scope !== 'undefined') {
          if (typeof cfg.scope !== 'string') throw 'scope, when specified, must be a string';
          if (cfg.scope.split('::').length > 1) throw "scope may not contain double colons: '::'";
        }

        /* private variables */
        // generate a random and psuedo unique id for this channel
        var chanId = (function () {
          var text = "";
          var alpha = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
          for(var i=0; i < 5; i++) text += alpha.charAt(Math.floor(Math.random() * alpha.length));
          return text;
        })();

        // registrations: mapping method names to call objects
        var regTbl = { };
        // current oustanding sent requests
        var outTbl = { };
        // current oustanding received requests
        var inTbl = { };
        // are we ready yet?  when false we will block outbound messages.
        var ready = false;
        var pendingQueue = [ ];

        var createTransaction = function(id,origin,callbacks) {
          var shouldDelayReturn = false;
          var completed = false;

          return {
            origin: origin,
            invoke: function(cbName, v) {
              // verify in table
              if (!inTbl[id]) throw "attempting to invoke a callback of a nonexistent transaction: " + id;
              // verify that the callback name is valid
              var valid = false;
              for (var i = 0; i < callbacks.length; i++) if (cbName === callbacks[i]) { valid = true; break; }
              if (!valid) throw "request supports no such callback '" + cbName + "'";

              // send callback invocation
              postMessage({ id: id, callback: cbName, params: v});
            },
            error: function(error, message) {
              completed = true;
              // verify in table
              if (!inTbl[id]) throw "error called for nonexistent message: " + id;

              // remove transaction from table
              delete inTbl[id];

              // send error
              postMessage({ id: id, error: error, message: message });
            },
            complete: function(v) {
              completed = true;
              // verify in table
              if (!inTbl[id]) throw "complete called for nonexistent message: " + id;
              // remove transaction from table
              delete inTbl[id];
              // send complete
              postMessage({ id: id, result: v });
            },
            delayReturn: function(delay) {
              if (typeof delay === 'boolean') {
                shouldDelayReturn = (delay === true);
              }
              return shouldDelayReturn;
            },
            completed: function() {
              return completed;
            }
          };
        };

        var setTransactionTimeout = function(transId, timeout, method) {
          return window.setTimeout(function() {
            if (outTbl[transId]) {
              // XXX: what if client code raises an exception here?
              var msg = "timeout (" + timeout + "ms) exceeded on method '" + method + "'";
              (1,outTbl[transId].error)("timeout_error", msg);
              delete outTbl[transId];
              delete s_transIds[transId];
            }
          }, timeout);
        };

        var onMessage = function(origin, method, m) {
          // if an observer was specified at allocation time, invoke it
          if (typeof cfg.gotMessageObserver === 'function') {
            // pass observer a clone of the object so that our
            // manipulations are not visible (i.e. method unscoping).
            // This is not particularly efficient, but then we expect
            // that message observers are primarily for debugging anyway.
            try {
              cfg.gotMessageObserver(origin, m);
            } catch (e) {
              debug("gotMessageObserver() raised an exception: " + e.toString());
            }
          }

          // now, what type of message is this?
          if (m.id && method) {
            // a request!  do we have a registered handler for this request?
            if (regTbl[method]) {
              var trans = createTransaction(m.id, origin, m.callbacks ? m.callbacks : [ ]);
              inTbl[m.id] = { };
              try {
                // callback handling.  we'll magically create functions inside the parameter list for each
                // callback
                if (m.callbacks && s_isArray(m.callbacks) && m.callbacks.length > 0) {
                  for (var i = 0; i < m.callbacks.length; i++) {
                    var path = m.callbacks[i];
                    var obj = m.params;
                    var pathItems = path.split('/');
                    for (var j = 0; j < pathItems.length - 1; j++) {
                      var cp = pathItems[j];
                      if (typeof obj[cp] !== 'object') obj[cp] = { };
                      obj = obj[cp];
                    }
                    obj[pathItems[pathItems.length - 1]] = (function() {
                      var cbName = path;
                      return function(params) {
                        return trans.invoke(cbName, params);
                      };
                    })();
                  }
                }
                var resp = regTbl[method](trans, m.params);
                if (!trans.delayReturn() && !trans.completed()) trans.complete(resp);
              } catch(e) {
                // automagic handling of exceptions:
                var error = "runtime_error";
                var message = null;
                // * if it's a string then it gets an error code of 'runtime_error' and string is the message
                if (typeof e === 'string') {
                  message = e;
                } else if (typeof e === 'object') {
                  // either an array or an object
                  // * if it's an array of length two, then  array[0] is the code, array[1] is the error message
                  if (e && s_isArray(e) && e.length == 2) {
                    error = e[0];
                    message = e[1];
                  }
                  // * if it's an object then we'll look form error and message parameters
                  else if (typeof e.error === 'string') {
                    error = e.error;
                    if (!e.message) message = "";
                    else if (typeof e.message === 'string') message = e.message;
                    else e = e.message; // let the stringify/toString message give us a reasonable verbose error string
                  }
                }

                // message is *still* null, let's try harder
                if (message === null) {
                  try {
                    message = JSON.stringify(e);
                    /* On MSIE8, this can result in 'out of memory', which
                     * leaves message undefined. */
                    if (typeof(message) == 'undefined')
                      message = e.toString();
                  } catch (e2) {
                    message = e.toString();
                  }
                }

                trans.error(error,message);
              }
            }
          } else if (m.id && m.callback) {
            if (!outTbl[m.id] ||!outTbl[m.id].callbacks || !outTbl[m.id].callbacks[m.callback])
            {
              debug("ignoring invalid callback, id:"+m.id+ " (" + m.callback +")");
            } else {
              // XXX: what if client code raises an exception here?
              outTbl[m.id].callbacks[m.callback](m.params);
            }
          } else if (m.id) {
            if (!outTbl[m.id]) {
              debug("ignoring invalid response: " + m.id);
            } else {
              // XXX: what if client code raises an exception here?
              if (m.error) {
                (1,outTbl[m.id].error)(m.error, m.message);
              } else {
                if (m.result !== undefined) (1,outTbl[m.id].success)(m.result);
                else (1,outTbl[m.id].success)();
              }
              delete outTbl[m.id];
              delete s_transIds[m.id];
            }
          } else if (method) {
            // tis a notification.
            if (regTbl[method]) {
              // yep, there's a handler for that.
              // transaction is null for notifications.
              regTbl[method](null, m.params);
              // if the client throws, we'll just let it bubble out
              // what can we do?  Also, here we'll ignore return values
            }
          }
        };

        // now register our bound channel for msg routing
        s_addBoundChan(cfg.window, cfg.origin, ((typeof cfg.scope === 'string') ? cfg.scope : ''), onMessage);

        // scope method names based on cfg.scope specified when the Channel was instantiated
        var scopeMethod = function(m) {
          if (typeof cfg.scope === 'string' && cfg.scope.length) m = [cfg.scope, m].join("::");
          return m;
        };

        // a small wrapper around postmessage whose primary function is to handle the
        // case that clients start sending messages before the other end is "ready"
        var postMessage = function(msg, force) {
          if (!msg) throw "postMessage called with null message";

          // delay posting if we're not ready yet.
          var verb = (ready ? "post  " : "queue ");
          debug(verb + " message: " + JSON.stringify(msg));
          if (!force && !ready) {
            pendingQueue.push(msg);
          } else {
            if (typeof cfg.postMessageObserver === 'function') {
              try {
                cfg.postMessageObserver(cfg.origin, msg);
              } catch (e) {
                debug("postMessageObserver() raised an exception: " + e.toString());
              }
            }

            cfg.window.postMessage(JSON.stringify(msg), cfg.origin);
          }
        };

        var onReady = function(trans, type) {
          debug('ready msg received');
          if (ready) throw "received ready message while in ready state.  help!";

          if (type === 'ping') {
            chanId += '-R';
          } else {
            chanId += '-L';
          }

          obj.unbind('__ready'); // now this handler isn't needed any more.
          ready = true;
          debug('ready msg accepted.');

          if (type === 'ping') {
            obj.notify({ method: '__ready', params: 'pong' });
          }

          // flush queue
          while (pendingQueue.length) {
            postMessage(pendingQueue.pop());
          }

          // invoke onReady observer if provided
          if (typeof cfg.onReady === 'function') cfg.onReady(obj);
        };

        var obj = {
          // tries to unbind a bound message handler.  returns false if not possible
          unbind: function (method) {
            if (regTbl[method]) {
              if (!(delete regTbl[method])) throw ("can't delete method: " + method);
              return true;
            }
            return false;
          },
          bind: function (method, cb) {
            if (!method || typeof method !== 'string') throw "'method' argument to bind must be string";
            if (!cb || typeof cb !== 'function') throw "callback missing from bind params";

            if (regTbl[method]) throw "method '"+method+"' is already bound!";
            regTbl[method] = cb;
            return this;
          },
          call: function(m) {
            if (!m) throw 'missing arguments to call function';
            if (!m.method || typeof m.method !== 'string') throw "'method' argument to call must be string";
            if (!m.success || typeof m.success !== 'function') throw "'success' callback missing from call";

            // now it's time to support the 'callback' feature of jschannel.  We'll traverse the argument
            // object and pick out all of the functions that were passed as arguments.
            var callbacks = { };
            var callbackNames = [ ];

            var pruneFunctions = function (path, obj) {
              if (typeof obj === 'object') {
                for (var k in obj) {
                  if (!obj.hasOwnProperty(k)) continue;
                  var np = path + (path.length ? '/' : '') + k;
                  if (typeof obj[k] === 'function') {
                    callbacks[np] = obj[k];
                    callbackNames.push(np);
                    delete obj[k];
                  } else if (typeof obj[k] === 'object') {
                    pruneFunctions(np, obj[k]);
                  }
                }
              }
            };
            pruneFunctions("", m.params);

            // build a 'request' message and send it
            var msg = { id: s_curTranId, method: scopeMethod(m.method), params: m.params };
            if (callbackNames.length) msg.callbacks = callbackNames;

            if (m.timeout)
              // XXX: This function returns a timeout ID, but we don't do anything with it.
              // We might want to keep track of it so we can cancel it using clearTimeout()
              // when the transaction completes.
              setTransactionTimeout(s_curTranId, m.timeout, scopeMethod(m.method));

            // insert into the transaction table
            outTbl[s_curTranId] = { callbacks: callbacks, error: m.error, success: m.success };
            s_transIds[s_curTranId] = onMessage;

            // increment current id
            s_curTranId++;

            postMessage(msg);
          },
          notify: function(m) {
            if (!m) throw 'missing arguments to notify function';
            if (!m.method || typeof m.method !== 'string') throw "'method' argument to notify must be string";

            // no need to go into any transaction table
            postMessage({ method: scopeMethod(m.method), params: m.params });
          },
          destroy: function () {
            s_removeBoundChan(cfg.window, cfg.origin, ((typeof cfg.scope === 'string') ? cfg.scope : ''));
            if (window.removeEventListener) window.removeEventListener('message', onMessage, false);
            else if(window.detachEvent) window.detachEvent('onmessage', onMessage);
            ready = false;
            regTbl = { };
            inTbl = { };
            outTbl = { };
            cfg.origin = null;
            pendingQueue = [ ];
            debug("channel destroyed");
            chanId = "";
          }
        };

        obj.bind('__ready', onReady);
        setTimeout(function() {
//          postMessage({ method: scopeMethod('__ready'), params: "ping" }, true);
        }, 0);

        return obj;
      }
    };
  })();

  // local embedded copy of winchan: http://github.com/lloyd/winchan
  // BEGIN WINCHAN

  ;WinChan = (function() {
    var RELAY_FRAME_NAME = "__winchan_relay_frame";
    var CLOSE_CMD = "die";

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
      if (navigator.appName === 'Microsoft Internet Explorer') {
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
        // We must check for both XUL and Java versions of Fennec.  Both have
        // distinct UA strings.
        var userAgent = navigator.userAgent;
        return (userAgent.indexOf('Fennec/') != -1) ||  // XUL
               (userAgent.indexOf('Firefox/') != -1 && userAgent.indexOf('Android') != -1);   // Java
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
      if (!/^https?:\/\//.test(url)) url = window.location.href;
      var m = /^(https?:\/\/[\-_a-zA-Z\.0-9:]+)/.exec(url);
      if (m) return m[1];
      return url;
    }

    // find the relay iframe in the opener
    function findRelay() {
      var loc = window.location;
      var frames = window.opener.frames;
      var origin = loc.protocol + '//' + loc.host;
      for (var i = frames.length - 1; i >= 0; i--) {
        try {
          if (frames[i].location.href.indexOf(origin) === 0 &&
              frames[i].name === RELAY_FRAME_NAME)
          {
            return frames[i];
          }
        } catch(e) { }
      }
      return;
    }

    var isIE = isInternetExplorer();

    if (isSupported()) {
      /*  General flow:
       *                  0. user clicks
       *  (IE SPECIFIC)   1. caller adds relay iframe (served from trusted domain) to DOM
       *                  2. caller opens window (with content from trusted domain)
       *                  3. window on opening adds a listener to 'message'
       *  (IE SPECIFIC)   4. window on opening finds iframe
       *                  5. window checks if iframe is "loaded" - has a 'doPost' function yet
       *  (IE SPECIFIC5)  5a. if iframe.doPost exists, window uses it to send ready event to caller
       *  (IE SPECIFIC5)  5b. if iframe.doPost doesn't exist, window waits for frame ready
       *  (IE SPECIFIC5)  5bi. once ready, window calls iframe.doPost to send ready event
       *                  6. caller upon reciept of 'ready', sends args
       */
      return {
        open: function(opts, cb) {
          if (!cb) throw "missing required callback argument";

          // test required options
          var err;
          if (!opts.url) err = "missing required 'url' parameter";
          if (!opts.relay_url) err = "missing required 'relay_url' parameter";
          if (err) setTimeout(function() { cb(err); }, 0);

          // supply default options
          if (!opts.window_name) opts.window_name = null;
          if (!opts.window_features || isFennec()) opts.window_features = undefined;

          // opts.params may be undefined

          var iframe;

          // sanity check, are url and relay_url the same origin?
          var origin = extractOrigin(opts.url);
          if (origin !== extractOrigin(opts.relay_url)) {
            return setTimeout(function() {
              cb('invalid arguments: origin of url and relay_url must match');
            }, 0);
          }

          var messageTarget;

          if (isIE) {
            // first we need to add a "relay" iframe to the document that's served
            // from the target domain.  We can postmessage into a iframe, but not a
            // window
            iframe = document.createElement("iframe");
            // iframe.setAttribute('name', framename);
            iframe.setAttribute('src', opts.relay_url);
            iframe.style.display = "none";
            iframe.setAttribute('name', RELAY_FRAME_NAME);
            document.body.appendChild(iframe);
            messageTarget = iframe.contentWindow;
          }

          var w = window.open(opts.url, opts.window_name, opts.window_features);

          if (!messageTarget) messageTarget = w;

          var req = JSON.stringify({a: 'request', d: opts.params});

          // cleanup on unload
          function cleanup() {
            if (iframe) document.body.removeChild(iframe);
            iframe = undefined;
            if (w) {
              try {
                w.close();
              } catch (securityViolation) {
                // This happens in Opera 12 sometimes
                // see https://github.com/mozilla/browserid/issues/1844
                messageTarget.postMessage(CLOSE_CMD, origin);
              }
            }
            w = messageTarget = undefined;
          }

          addListener(window, 'unload', cleanup);

          function onMessage(e) {
            try {
              var d = JSON.parse(e.data);
              if (d.a === 'ready') messageTarget.postMessage(req, origin);
              else if (d.a === 'error') {
                if (cb) {
                  cb(d.d);
                  cb = null;
                }
              } else if (d.a === 'response') {
                removeListener(window, 'message', onMessage);
                removeListener(window, 'unload', cleanup);
                cleanup();
                if (cb) {
                  cb(null, d.d);
                  cb = null;
                }
              }
            } catch(err) { }
          }

          addListener(window, 'message', onMessage);

          return {
            close: cleanup,
            focus: function() {
              if (w) {
                try {
                  w.focus();
                } catch (e) {
                  // IE7 blows up here, do nothing
                }
              }
            }
          };
        }
      };
    } else {
      return {
        open: function(url, winopts, arg, cb) {
          setTimeout(function() { cb("unsupported browser"); }, 0);
        }
      };
    }
  })();



  // END WINCHAN

  var BrowserSupport = (function() {
    var win = window,
        nav = navigator,
        reason;

    // For unit testing
    function setTestEnv(newNav, newWindow) {
      nav = newNav;
      win = newWindow;
    }

    function getInternetExplorerVersion() {
      var rv = -1; // Return value assumes failure.
      if (nav.appName == 'Microsoft Internet Explorer') {
        var ua = nav.userAgent;
        var re = new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})");
        if (re.exec(ua) != null)
          rv = parseFloat(RegExp.$1);
      }

      return rv;
    }

    function checkIE() {
      var ieVersion = getInternetExplorerVersion(),
          ieNosupport = ieVersion > -1 && ieVersion < 8;

      if(ieNosupport) {
        return "BAD_IE_VERSION";
      }
    }

    function explicitNosupport() {
      return checkIE();
    }

    function checkLocalStorage() {
      // Firefox/Fennec/Chrome blow up when trying to access or
      // write to localStorage. We must do two explicit checks, first
      // whether the browser has localStorage.  Second, we must check
      // whether the localStorage can be written to.  Firefox (at v11)
      // throws an exception when querying win['localStorage']
      // when cookies are disabled. Chrome (v17) excepts when trying to
      // write to localStorage when cookies are disabled. If an
      // exception is thrown, then localStorage is disabled. If no
      // exception is thrown, hasLocalStorage will be true if the
      // browser supports localStorage and it can be written to.
      try {
        var hasLocalStorage = 'localStorage' in win
                        // Firefox will except here if cookies are disabled.
                        && win['localStorage'] !== null;

        if(hasLocalStorage) {
          // browser has localStorage, check if it can be written to. If
          // cookies are disabled, some browsers (Chrome) will except here.
          win['localStorage'].setItem("test", "true");
          win['localStorage'].removeItem("test");
        }
        else {
          // Browser does not have local storage.
          return "LOCALSTORAGE_NOT_SUPPORTED";
        }
      } catch(e) {
          return "LOCALSTORAGE_DISABLED";
      }
    }

    function checkPostMessage() {
      if(!win.postMessage) {
        return "POSTMESSAGE_NOT_SUPPORTED";
      }
    }

    function checkJSON() {
      if(!(window.JSON && window.JSON.stringify && window.JSON.parse)) {
        return "JSON_NOT_SUPPORTED";
      }
    }

    function isSupported() {
      reason = explicitNosupport() || checkLocalStorage() || checkPostMessage() || checkJSON();

      return !reason;
    }


    function getNoSupportReason() {
      return reason;
    }

    return {
      /**
       * Set the test environment.
       * @method setTestEnv
       */
      setTestEnv: setTestEnv,
      /**
       * Check whether the current browser is supported
       * @method isSupported
       * @returns {boolean}
       */
      isSupported: isSupported,
      /**
       * Called after isSupported, if isSupported returns false.  Gets the reason
       * why browser is not supported.
       * @method getNoSupportReason
       * @returns {string}
       */
      getNoSupportReason: getNoSupportReason
    };
  }());

  if (!navigator.id) {
    navigator.id = {};
  }

  if (!navigator.id.request || navigator.id._shimmed) {
    var ipServer = "https://login.persona.org";
    var userAgent = navigator.userAgent;
    // We must check for both XUL and Java versions of Fennec.  Both have
    // distinct UA strings.
    var isFennec = (userAgent.indexOf('Fennec/') != -1) ||  // XUL
                     (userAgent.indexOf('Firefox/') != -1 && userAgent.indexOf('Android') != -1);   // Java

    var windowOpenOpts =
      (isFennec ? undefined :
       "menubar=0,location=1,resizable=1,scrollbars=1,status=0,dialog=1,minimizable=1,width=700,height=375");

    var w;

    // table of registered observers
    var observers = {
      login: null,
      logout: null,
      ready: null
    };

    var loggedInUser;

    var compatMode = undefined;
    function checkCompat(requiredMode) {
      if (requiredMode === true) {
        // this deprecation warning should be re-enabled when the .watch and .request APIs become final.
        // try { console.log("this site uses deprecated APIs (see documentation for navigator.id.request())"); } catch(e) { }
      }

      if (compatMode === undefined) compatMode = requiredMode;
      else if (compatMode != requiredMode) {
        throw new Error("you cannot combine the navigator.id.watch() API with navigator.id.getVerifiedEmail() or navigator.id.get()" +
              "this site should instead use navigator.id.request() and navigator.id.watch()");
      }
    }

    var commChan,
        waitingForDOM = false,
        browserSupported = BrowserSupport.isSupported();

    function domReady(callback) {
      if (document.addEventListener) {
        document.addEventListener('DOMContentLoaded', function contentLoaded() {
          document.removeEventListener('DOMContentLoaded', contentLoaded);
          callback();
        }, false);
      } else if (document.attachEvent && document.readyState) {
        document.attachEvent('onreadystatechange', function ready() {
          var state = document.readyState;
          // 'interactive' is the same as DOMContentLoaded,
          // but not all browsers use it, sadly.
          if (state === 'loaded' || state === 'complete' || state === 'interactive') {
            document.detachEvent('onreadystatechange', ready);
            callback();
          }
        });
      }
    }


    // this is for calls that are non-interactive
    function _open_hidden_iframe() {
      // If this is an unsupported browser, do not even attempt to add the
      // IFRAME as doing so will cause an exception to be thrown in IE6 and IE7
      // from within the communication_iframe.
      if(!browserSupported) return;
      var doc = window.document;

      // can't attach iframe and make commChan without the body
      if (!doc.body) {
        if (!waitingForDOM) {
          domReady(_open_hidden_iframe);
          waitingForDOM = true;
        }
        return;
      }

      try {
        if (!commChan) {
          var iframe = doc.createElement("iframe");
          iframe.style.display = "none";
          doc.body.appendChild(iframe);
          iframe.src = ipServer + "/communication_iframe";
          commChan = Channel.build({
            window: iframe.contentWindow,
            origin: ipServer,
            scope: "mozid_ni",
            onReady: function() {
              // once the channel is set up, we'll fire a loaded message.  this is the
              // cutoff point where we'll say if 'setLoggedInUser' was not called before
              // this point, then it wont be called (XXX: optimize and improve me)
              commChan.call({
                method: 'loaded',
                success: function(){
                  // NOTE: Do not modify without reading GH-2017
                  if (observers.ready) observers.ready();
                }, error: function() {
                }
              });
            }
          });

          commChan.bind('logout', function(trans, params) {
            if (observers.logout) observers.logout();
          });

          commChan.bind('login', function(trans, params) {
            if (observers.login) observers.login(params);
          });

          if (defined(loggedInUser)) {
            commChan.notify({
              method: 'loggedInUser',
              params: loggedInUser
            });
          }
        }
      } catch(e) {
        // channel building failed!  let's ignore the error and allow higher
        // level code to handle user messaging.
        commChan = undefined;
      }
    }

    function defined(item) {
      return typeof item !== "undefined";
    }

    function warn(message) {
      try {
        console.warn(message);
      } catch(e) {
        /* ignore error */
      }
    }

    function checkDeprecated(options, field) {
      if(defined(options[field])) {
        warn(field + " has been deprecated");
        return true;
      }
    }

    function checkRenamed(options, oldName, newName) {
      if (defined(options[oldName]) &&
          defined(options[newName])) {
        throw new Error("you cannot supply *both* " + oldName + " and " + newName);
      }
      else if(checkDeprecated(options, oldName)) {
        options[newName] = options[oldName];
        delete options[oldName];
      }
    }

    function internalWatch(options) {
      if (typeof options !== 'object') return;

      if (options.onlogin && typeof options.onlogin !== 'function' ||
          options.onlogout && typeof options.onlogout !== 'function' ||
          options.onready && typeof options.onready !== 'function')
      {
        throw new Error("non-function where function expected in parameters to navigator.id.watch()");
      }

      if (!options.onlogin) throw new Error("'onlogin' is a required argument to navigator.id.watch()");
      if (!options.onlogout) throw new Error("'onlogout' is a required argument to navigator.id.watch()");

      observers.login = options.onlogin || null;
      observers.logout = options.onlogout || null;
      // NOTE: Do not modify without reading GH-2017
      observers.ready = options.onready || null;

      // back compat support for loggedInEmail
      checkRenamed(options, "loggedInEmail", "loggedInUser");
      loggedInUser = options.loggedInUser;

      _open_hidden_iframe();
    }

    var api_called;
    function getRPAPI() {
      var rp_api = api_called;
      if (rp_api === "request") {
        if (observers.ready) rp_api = "watch_with_onready";
        else rp_api = "watch_without_onready";
      }

      return rp_api;
    }

    function internalRequest(options) {
      checkDeprecated(options, "requiredEmail");
      checkRenamed(options, "tosURL", "termsOfService");
      checkRenamed(options, "privacyURL", "privacyPolicy");

      if (options.termsOfService && !options.privacyPolicy) {
        warn("termsOfService ignored unless privacyPolicy also defined");
      }

      if (options.privacyPolicy && !options.termsOfService) {
        warn("privacyPolicy ignored unless termsOfService also defined");
      }

      options.rp_api = getRPAPI();
      // reset the api_called in case the site implementor changes which api
      // method called the next time around.
      api_called = null;

      // focus an existing window
      if (w) {
        try {
          w.focus();
        }
        catch(e) {
          /* IE7 blows up here, do nothing */
        }
        return;
      }

      if (!BrowserSupport.isSupported()) {
        var reason = BrowserSupport.getNoSupportReason(),
        url = "unsupported_dialog";

        if(reason === "LOCALSTORAGE_DISABLED") {
          url = "cookies_disabled";
        }

        w = window.open(
          ipServer + "/" + url,
          null,
          windowOpenOpts);
        return;
      }

      // notify the iframe that the dialog is running so we
      // don't do duplicative work
      if (commChan) commChan.notify({ method: 'dialog_running' });

      w = WinChan.open({
        url: ipServer + '/sign_in',
        relay_url: ipServer + '/relay',
        window_features: windowOpenOpts,
        window_name: '__persona_dialog',
        params: {
          method: "get",
          params: options
        }
      }, function(err, r) {
        // unpause the iframe to detect future changes in login state
        if (commChan) {
          // update the loggedInUser in the case that an assertion was generated, as
          // this will prevent the comm iframe from thinking that state has changed
          // and generating a new assertion.  IF, however, this request is not a success,
          // then we do not change the loggedInUser - and we will let the comm frame determine
          // if generating a logout event is the right thing to do
          if (!err && r && r.email) {
            commChan.notify({ method: 'loggedInUser', params: r.email });
          }
          commChan.notify({ method: 'dialog_complete' });
        }

        // clear the window handle
        w = undefined;
        if (!err && r && r.assertion) {
          try {
            if (observers.login) observers.login(r.assertion);
          } catch(e) {
            // client's observer threw an exception
          }
        }

        // if either err indicates the user canceled the signin (expected) or a
        // null response was sent (unexpected), invoke the .oncancel() handler.
        if (err === 'client closed window' || !r) {
          if (options && options.oncancel) options.oncancel();
          delete options.oncancel;
        }
      });
    };

    navigator.id = {
      watch: function(options) {
        if (this != navigator.id)
          throw new Error("all navigator.id calls must be made on the navigator.id object");
        checkCompat(false);
        internalWatch(options);
      },
      request: function(options) {
        if (this != navigator.id)
          throw new Error("all navigator.id calls must be made on the navigator.id object");
        options = options || {};
        checkCompat(false);
        api_called = "request";
        // returnTo is used for post-email-verification redirect
        if (!options.returnTo) options.returnTo = document.location.pathname;
        return internalRequest(options);
      },
      // logout from the current website
      // The callback parameter is DEPRECATED, instead you should use the
      // the .onlogout observer of the .watch() api.
      logout: function(callback) {
        if (this != navigator.id)
          throw new Error("all navigator.id calls must be made on the navigator.id object");
        // allocate iframe if it is not allocated
        _open_hidden_iframe();
        // send logout message if the commChan exists
        if (commChan) commChan.notify({ method: 'logout' });
        if (typeof callback === 'function') {
          warn('navigator.id.logout callback argument has been deprecated.');
          setTimeout(callback, 0);
        }
      },
      // get an assertion
      get: function(callback, passedOptions) {
        var opts = {};
        passedOptions = passedOptions || {};
        opts.privacyPolicy =  passedOptions.privacyPolicy || undefined;
        opts.termsOfService = passedOptions.termsOfService || undefined;
        opts.privacyURL = passedOptions.privacyURL || undefined;
        opts.tosURL = passedOptions.tosURL || undefined;
        opts.siteName = passedOptions.siteName || undefined;
        opts.siteLogo = passedOptions.siteLogo || undefined;
        // api_called could have been set to getVerifiedEmail already
        api_called = api_called || "get";
        if (checkDeprecated(passedOptions, "silent")) {
          // Silent has been deprecated, do nothing.  Placing the check here
          // prevents the callback from being called twice, once with null and
          // once after internalWatch has been called.  See issue #1532
          if (callback) setTimeout(function() { callback(null); }, 0);
          return;
        }

        checkCompat(true);
        internalWatch({
          onlogin: function(assertion) {
            if (callback) {
              callback(assertion);
              callback = null;
            }
          },
          onlogout: function() {}
        });
        opts.oncancel = function() {
          if (callback) {
            callback(null);
            callback = null;
          }
          observers.login = observers.logout = observers.ready = null;
        };
        internalRequest(opts);
      },
      // backwards compatibility with old API
      getVerifiedEmail: function(callback) {
        warn("navigator.id.getVerifiedEmail has been deprecated");
        checkCompat(true);
        api_called = "getVerifiedEmail";
        navigator.id.get(callback);
      },
      // required for forwards compatibility with native implementations
      _shimmed: true
    };
  }
}());
