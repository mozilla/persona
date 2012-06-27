/**
* Author Shane Tomlinson
* Original source can be found at:
* https://github.com/stomlinson/appcore/blob/master/js/module.js
* Licences under Mozilla Tri-License
*/
BrowserID.module = (function() {
  "use strict";

  var registration = {},
      created = {},
      running = {};

  function register(service, module, config) {
    if (!module) {
      throw "module constructor missing for " + service;
    }

    registration[service] = {
      constructor: module,
      config: config
    };
  }

  function getRegistration(service) {
    return registration[service];
  }

  function getModule(service) {
    return registration[service].constructor;
  }

  function getRunningModule(service) {
    var module = running[service];

    if(!module) {
      throw "no module running for " + service;
    }

    return module;
  }

  function reset() {
    registration = {};
    running = {};
    created = {};
  }

  function start(service, data) {
    if (running[service]) {
      throw "module already running for " + service;
    }

    var module = created[service];

    if (!module) {
      var registration = getRegistration(service);
      if (registration) {
        var constr = registration.constructor,
            config = registration.config;

        module = new constr();
        created[service] = module;
        module.init(config || {});
      }
      else {
        throw "module not registered for " + service;
      }
    }

    module.start(data || {});
    running[service] = module;

    return module;
  }

  function stop(service) {
    var module = running[service];

    if (module) {
      module.stop();
      delete running[service];
    }
    else {
      throw "module not started for " + service;
    }
  }

  function stopAll() {
    for(var key in running) {
      var module = running[key];
      module.stop();
      delete running[key];
    }
  }


  return {
    register: register,
    getModule: getModule,
    getRunningModule: getRunningModule,
    reset: reset,
    start: start,
    stop: stop,
    stopAll: stopAll
  };
}());
