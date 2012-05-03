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
      id: currID++,
      callback: context ? callback.bind(context) : callback
    });

    return id;
  }

  function fire(message) {
    var messageListeners = listeners[message];

    if(messageListeners) {
      for(var i = 0, listener; listener = messageListeners[i]; ++i) {
        listener.callback.apply(null, arguments);
      }
    }
    
    for(var j = 0, glistener; glistener = globalListeners[j]; ++j) {
      glistener.callback.apply(null, arguments);
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
        globalListeners.splice(i, 1);
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
