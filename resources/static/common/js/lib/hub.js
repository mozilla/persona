/**
* Author Shane Tomlinson
* Original source can be found at:
* https://github.com/stomlinson/message_hub/blob/master/src/hub.js
* Licenced under Mozilla Tri-License
*/
Hub = (function() {
  "use strict";

  var globalListeners = [],
      listeners = {},
      currID = 0;

  function on(message, callback, context) {
    var messageListeners = listeners[message] = listeners[message] || [],
        id = currID;

    messageListeners.push({
      id: currID,
      callback: context ? callback.bind(context) : callback
    });

    currID++;
    return id;
  }

  function all(callback, context) {
    globalListeners.push({
      id: currID,
      callback: context ? callback.bind(context) : callback
    });

    return currID++;
  }

  function fire(message) {
    for(var j = 0, glistener; glistener = globalListeners[j]; ++j) {
      // global listeners get the message name as the first argument
      glistener.callback.apply(null, arguments);
    }

    var messageListeners = listeners[message];

    if(messageListeners) {
      // XXX: deviation from upstream!  upstream code doesn't pass
      // 'message' as the first argument.  our code expects it.
      // at some point we should modify all callers of hub.on() to
      // not expect first arg to be message.
      for(var i = 0, listener; listener = messageListeners[i]; ++i) {
        listener.callback.apply(null, arguments);
      }
    }
  }

  function off(id) {
    for(var key in listeners) {
      var messageListeners = listeners[key];
      for(var i = 0, listener; listener = messageListeners[i]; ++i) {
        if(listener.id === id) {
          messageListeners.splice(i, 1);
          break;
        }
      }
    }

    for(var j = 0, glistener; glistener = globalListeners[j]; ++j) {
      if(glistener.id === id) {
        globalListeners.splice(j, 1);
        break;
      }
    }
  }

  function reset() {
    listeners = {};
    globalListeners = [];
    currID = 0;
  }

  return {
    all: all,
    on: on,
    fire: fire,
    reset: reset,
    off: off
  };
}());
