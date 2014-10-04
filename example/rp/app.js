/* Android 2.x doesn't support deferred scripts, so we use DOMContentLoaded.
   IE8 doesn't support DOMContentLoaded, but we have a polyfill, so it's OK.
   IE8/9 can act poorly with multiple deferred scripts, but we only use one.

   Other platforms respect the "defer" attribute and execute upon DOM ready.

   After we drop Android 2.x, we can trust defer and ditch DOMContentLoaded.
*/

document.addEventListener("DOMContentLoaded", function (event) {
  'use strict';

  /* HACK: IE8 doesn't support object.addEventListener */
  function listen(obj, evtName, handler) {
    if (obj.attachEvent) {
      obj.attachEvent('on' + evtName,  handler);
    } else {
      obj.addEventListener(evtName, handler);
    }
  }

  function stringify(obj) {
    function replacer(k, v) {
      return typeof v === 'function' ? '[callback]' : v;
    }

    var s = JSON.stringify(obj, replacer, 2);
    s = s.replace(/\r?\n/g, ''); // Strip newlines
    s = s.replace(/^\{\s+/, '{'); // Strip leading space after first '{'

    return s;
  }


  function log(type, text) {
    // log("hello, world") -> log("info", "hello, world");
    if (text === undefined) {
      text = type;
      type = "info";
    }

    var ol = document.getElementById('event-logs');

    var li = document.createElement('li');
    li.className = "log-entry" + " " + type.toLowerCase();

    var label = document.createElement('span');
    label.className = 'label';
    // IE8 doesn't have textContent
    label[label.textContent === undefined ? 'innerText' : 'textContent'] = type;

    var message = document.createElement('span');
    message.className = 'message';
    // IE8 doesn't have textContent
    message[message.textContent === undefined ? 'innerText' : 'textContent'] = text;

    li.appendChild(label);
    li.appendChild(document.createTextNode(' '));
    li.appendChild(message);

    ol.appendChild(li);
  }

  /* Load the shim from designated origin */
  (function () {
    var shims = {
      dev: "https://login.dev.anosrep.org",
      stage: "https://login.anosrep.org",
      prod: "https://login.persona.org",
      fxos: "https://firefoxos.persona.org",
      local: "{{ PUBLIC_URL }}" // Replaced by Express during post-processing
    };

    // Not running under Express? Use production Persona by default.
    if (shims.local === "{{ " + "PUBLIC_URL" + " }}") {
      shims.local = shims.prod;
    }

    var query = window.location.search.substring(1);
    var script = document.createElement('script');
    script.src = (shims[query] || shims.local) + "/include.js";
    document.body.appendChild(script);
    log("Loading shim from " + script.src);
  }());

  /* Handle clicks on preset buttons */
  (function () {
    function handler(e) {
      // HACK: IE8 doesn't support event.currentTarget
      var el = e.srcElement || e.currentTarget;
      var id = el.getAttribute('data-for');
      var field = document.getElementById(id);

      if (!(el.hasAttribute('data-for') && el.hasAttribute('data-value'))) {
        console.error("Preset missing data-for or data-value attributes");
        return;
      }

      if (!(field && field instanceof HTMLInputElement)) {
        console.error("Unable to find element #" + id);
        return;
      }

      field.value = el.getAttribute('data-value');
    }

    // Apply the handler to all preset buttons.
    var presets = document.querySelectorAll('button.preset');
    var i;
    for (i = 0; i < presets.length; i++) {
      listen(presets[i], 'click', handler);
    }
  }());

  /* Handle clicks on action buttons */
  (function () {
    /* Helper to pull option values out of the page */
    function parseOpts(prefix, options) {
      var result = {};

      var option, meta, el;
      for (option in options) {
        if (options.hasOwnProperty(option)) {
          meta = options[option];
          el = document.getElementById(prefix + '-' + option);
          if (!el) {
            console.warn("Expected to find element #" + prefix + "-" + option);
            continue;
          }

          switch (meta.type) {
          case String:
            if (el.value) { result[option] = el.value; }
            break;
          case Boolean:
            if (el.checked) { result[option] = meta.value; }
            break;
          }
        }
      }

      return result;
    }

    /* Helper to check / parse assertions */
    function checkAssertion(assertion) {
      log("assertion", assertion);
    }

    /* Various Persona callbacks */
    var callbacks = {
      onlogin: function (assertion) {
        log("callback", "onlogin(assertion);");
        checkAssertion(assertion);
      },

      onready: function () {
        log("callback", "onready();");
      },

      onlogout: function () {
        log("callback", "onlogout();");
      },

      onmatch: function () {
        log("callback", "onmatch();");
      },

      oncancel: function () {
        log("callback", "oncancel();");
      },

      get: function (assertion) {
        if (assertion) {
          log("callback", "(With assertion)");
          checkAssertion(assertion);
        } else if (assertion === null) {
          log("callback", "(Null assertion; user cancelled popup)");
        } else {
          log("error", "Unexpected falsey assertion: " + assertion);
        }
      }
    };

    /* navigator.id.watch(); */
    var watchBtn = document.getElementById('watch--button');
    if (watchBtn) {
      listen(watchBtn, 'click', function () {
        var options = parseOpts('watch', {
          // Supported
          onlogin:         { type: Boolean, value: callbacks.onlogin },
          onready:         { type: Boolean, value: callbacks.onready },
          siteName:        { type: String },
          siteLogo:        { type: String },
          backgroundColor: { type: String },
          // Deprecated
          onlogout:        { type: Boolean, value: callbacks.onlogout },
          onmatch:         { type: Boolean, value: callbacks.onmatch },
          loggedInUser:    { type: String }
        });

        // Hack in special values for loggedInUser
        var specialCases = {
          'undefined': undefined,
          'null': null,
          'false': false
        };

        if (options.loggedInUser && specialCases.hasOwnProperty(options.loggedInUser)) {
          options.loggedInUser = specialCases[options.loggedInUser];
        }

        log('function', 'navigator.id.watch(' + stringify(options) + ');');
        navigator.id.watch(options);
      });
    }

    /* navigator.id.request(); */
    var requestBtn = document.getElementById('request--button');
    if (requestBtn) {
      listen(requestBtn, 'click', function () {
        var options = parseOpts('request', {
          // Supported
          oncancel:       { type: Boolean, value: callbacks.oncancel },
          email:          { type: String },
          // Deprecated
          termsOfService: { type: String },
          privacyPolicy:  { type: String },
          returnTo:       { type: String },
          // Experimental
          experimental_forceAuthentication: { type: Boolean, value: 'true' },
          experimental_allowUnverified:     { type: Boolean, value: 'true' },
          experimental_forceIssuer:         { type: String }
        });

        log('function', 'navigator.id.request(' + stringify(options) + ');');
        navigator.id.request(options);
      });
    }

    /* navigator.id.logout(); */
    var logoutBtn = document.getElementById('logout--button');
    if (logoutBtn) {
      listen(logoutBtn, 'click', function () {

        log('function', 'navigator.id.logout();');
        navigator.id.logout();
      });
    }

    /* navigator.id.get(); */
    var getBtn = document.getElementById('get--button');
    if (getBtn) {
      listen(getBtn, 'click', function () {
        var options = parseOpts('get', {
          siteName:        { type: String },
          siteLogo:        { type: String },
          backgroundColor: { type: String },
          termsOfService:  { type: String },
          privacyPolicy:   { type: String }
        });

        log('function', 'navigator.id.get(callback, ' + stringify(options) + ');');
        navigator.id.get(callbacks.get, options);
      });
    }
  }());
});
