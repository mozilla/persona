(function() {
  /* Triggered Callbacks */

  function getCallback(assertion) {
    if (assertion) {
      log("Triggered .get()'s callback with assertion", assertion);
      checkAssertion(assertion);
    } else {
      log("User cancelled popup; assertion is " + assertion);
    }
  }

  function onlogin(assertion) {
    log("Triggered onlogin(...); with assertion", assertion);
    checkAssertion(assertion);
  }

  function onready() {
    log("Triggered onready();");
  }

  function oncancel() {
    log("Triggered oncancel();");
  }

  function onlogout() {
    log("Triggered onlogout();");
  }

  function onmatch() {
    log("Triggered onmatch();");
  }

  /* Utilities */

  function prettyPrint(json) {
    return JSON.stringify(json, undefined, 2);
  }

  function appendText(node, text) {
    node.appendChild(document.createTextNode(text));
  }

  var eventLog = document.getElementById('eventLog');
  function log(msg, assertion) {
    var li = document.createElement('li');
    appendText(li, msg);
    eventLog.appendChild(li);

    if (assertion) {
      var assertionLog = document.getElementById('assertionLog').appendChild(document.createElement('li'));

      // Log raw assertion
      var textarea = document.createElement('textarea');
      appendText(textarea, assertion);
      assertionLog.appendChild(textarea);

      // Log parsed assertion
      var code = document.createElement('code');
      var pre = document.createElement('pre');
      code.appendChild(pre);

      var parsed = parseAssertion(assertion);

      appendText(pre, "// ASSERTION\n");
      appendText(pre, JSON.stringify(parsed.assertion.header));
      appendText(pre, "\n\n");
      appendText(pre, prettyPrint(parsed.assertion.payload));

      appendText(pre, "\n\n");

      appendText(pre, "// CERTIFICATE\n");
      appendText(pre, JSON.stringify(parsed.certificate.header));
      appendText(pre, "\n\n");
      appendText(pre, prettyPrint(parsed.certificate.payload));

      assertionLog.appendChild(code);
    }
  }

  function readOpts(options) {
    var args = {};
    var el, meta;

    for (var opt in options) {
      if (options.hasOwnProperty(opt)) {
        meta = options[opt];
        el = document.getElementById(meta.id);

        // If checkbox, use value above.
        // Otherwise, use value of field itself.
        if ('value' in meta) {
          if (el.checked) { args[opt] = meta.value; }
        } else {
          if (el.value) { args[opt] = el.value; }
        }
      }
    }

    return args;
  }

  function decode(s) {
    // Convert back to normal Base64 from URLSafe Base64
    var b64 = s.replace(/-/g, '+').replace(/_/g, '/');

    // Restore padding
    var padding = { 0: '', 2: '==', 3: '=' };
    s += padding[s.length % 4];

    // Base64 decode
    return JSON.parse(atob(s));
  }

  function parseAssertion(assertion) {
    var parts = assertion.split('~');
    var certificate = parts[0];
    var assertion = parts[1];

    return {
      assertion: {
        header: decode(assertion.split('.')[0]),
        payload: decode(assertion.split('.')[1]),
      },
      certificate: {
        header: decode(certificate.split('.')[0]),
        payload: decode(certificate.split('.')[1]),
      },
    };
  }

  function getXHR() {
    if (window.XMLHttpRequest) {
      return new XMLHttpRequest();
    } else if (window.ActiveXObject) {
      try {
        return new ActiveXObject("Msxml2.XMLHTTP");
      }
      catch (e) {
        try {
          return new ActiveXObject("Microsoft.XMLHTTP");
        }
        catch (e) {}
      }
    }
  }

  function checkAssertion(assertion) {
    var xhr = getXHR();

    xhr.onreadystatechange = function () {
      var body;
      if (xhr.readyState === 4) {
        body = xhr.responseText && JSON.parse(xhr.responseText);
        if (body) {
          log("Verifier Response: " + body.status + " for " + body.email);
        } else {
          log("Verifier failed to respond.");
        }
      }
    }

    var forceIssuer = document.getElementById('verifierForceIssuer').value;
    var allowUnverified = document.getElementById('verifierAllowUnverified').checked;

    xhr.open('POST', '/process_assertion', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify({
      assertion: assertion,
      audience: window.location.protocol + "//" + window.location.host,
      forceIssuer: forceIssuer ? forceIssuer : undefined,
      allowUnverified: allowUnverified ? "true" : "false",
    }));
  }

  /* Button Clicks */

  var watchBtn = document.getElementById('watch');
  watchBtn.onclick = function() {
    var options = readOpts({
      // Checkboxes
      onlogin: { id: 'watchOnlogin', value: onlogin },
      onready: { id: 'watchOnready', value: onready },
      onlogout: { id: 'watchOnlogout', value: onlogout },
      onmatch: { id: 'watchOnmatch', value: onmatch },

      // Freeform text
      loggedInUser:    { id: 'watchLoggedInUser' },
      siteName:        { id: 'watchSiteName' },
      siteLogo:        { id: 'watchSiteLogo' },
      backgroundColor: { id: 'watchBackgroundColor' },
    });

    // Special processing for loggedInUser
    var specialUsers = { 'undefined': undefined, 'null': null, 'false': false };
    if (options.loggedInUser && options.loggedInUser in specialUsers) {
      options.loggedInUser = specialUsers[options.loggedInUser];
    }

    log("Invoking navigator.id.watch(...);");
    console && console.log("Invoking navigator.id.watch(...);");
    console && console.log(options);

    navigator.id.watch(options);
  };

  var requestBtn = document.getElementById('request');
  requestBtn.onclick = function() {
    var options = readOpts({
      oncancel: { id: 'requestOncancel', value: oncancel },
      experimental_allowUnverified: { id: 'requestAllowUnverified', value: 'true' },
      experimental_forceAuthentication: { id: 'requestForceAuthentication', value: 'true' },

      email: { id: 'requestEmail' },
      termsOfService:  { id: 'requestTermsOfService' },
      privacyPolicy:   { id: 'requestPrivacyPolicy' },
      returnTo:   { id: 'requestReturnTo' },
      experimental_forceIssuer: { id: 'requestForceIssuer' },
    });

    log("Invoking navigator.id.request(...);");
    console && console.log("Invoking navigator.id.request(...);");
    console && console.log(options);

    navigator.id.request(options);
  };

  var getBtn = document.getElementById('get');
  getBtn.onclick = function() {
    var options = readOpts({
      siteName:        { id: 'getSiteName' },
      siteLogo:        { id: 'getSiteLogo' },
      backgroundColor: { id: 'getBackgroundColor' },
      termsOfService:  { id: 'getTermsOfService' },
      privacyPolicy:   { id: 'getPrivacyPolicy' },
    });

    log("Invoking navigator.id.get(callback, ...);");
    console && console.log("Invoking navigator.id.get(callback, ...);");
    console && console.log(options);

    navigator.id.get(getCallback, options);
  };

  var presets = document.getElementsByClassName('preset');
  var preset, target, data;
  for (var i = 0; i < presets.length; i++) {
    preset = presets[i];
    preset.addEventListener('click', function(e) {
      var el = e.target;
      var field = document.getElementById(el.getAttribute('data-for'));
      field.value = el.getAttribute('data-value');
    });
  }

  /* Load the shim from designated origin */
  (function() {
    var shims = {
      dev: "https://login.dev.anosrep.org",
      stage: "https://login.anosrep.org",
      prod: "https://login.persona.org",
      fxos: "https://firefoxos.persona.org",
      local: "{{ PUBLIC_URL }}", // Replaced by Express during post-processing
    }

    var query = window.location.search.substring(1);

    var script = document.createElement('script');
    script.src = (shims[query] || shims.local) + "/include.js";

    log("Loading shim from " + script.src);

    document.body.appendChild(script);
  })();
})();
