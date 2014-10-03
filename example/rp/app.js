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
    console.log("Loading shim from " + script.src);
  }());

  /* Handle clicks on preset buttons */
  (function () {
    function handler(e) {
      // HACK: IE8 doesn't support event.currentTarget
      var el = e.srcElement ? e.srcElement : e.currentTarget;
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
      console.log("FIXME: Checking assertion: " + assertion); // FIXME
    }

    /* Various Persona callbacks */
    var callbacks = {
      onlogin: function (assertion) {
        console.log("onlogin fired");
        checkAssertion(assertion);
      },

      onready: function () {
        console.log("onready fired");
      },

      onlogout: function () {
        console.log("onlogout fired");
      },

      onmatch: function () {
        console.log("onmatch fired");
      },

      oncancel: function () {
        console.log("oncancel fired");
      },

      get: function (assertion) {
        if (assertion) {
          console.log("get's callback returned an assertion");
          checkAssertion(assertion);
        } else if (assertion === null) {
          console.log("get's callback returned received a null assertion; user cancelled the popup");
        } else {
          console.error("get's callback returned an unexpected false-y assertion: " + assertion);
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

        navigator.id.request(options);
      });
    }

    /* navigator.id.logout(); */
    var logoutBtn = document.getElementById('logout--button');
    if (logoutBtn) {
      listen(logoutBtn, 'click', function () {
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

        navigator.id.get(callbacks.get, options);
      });
    }
  }());
});
