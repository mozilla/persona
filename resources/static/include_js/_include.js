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
    // Is there a native implementation on this platform?
    // If so, hook navigator.id onto it.
    if (navigator.mozId) {
      navigator.id = navigator.mozId;
    } else {
      navigator.id = {};
    }
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
       "menubar=0,location=1,resizable=1,scrollbars=1,status=0,width=700,height=375");

    // Chrome for iOS
    //    - https://developers.google.com/chrome/mobile/docs/user-agent
    // Windows Phone
    //    - http://stackoverflow.com/questions/11381673/javascript-solution-to-detect-mobile-browser
    var needsPopupFix = userAgent.match(/CriOS/) ||
                        userAgent.match(/Windows Phone/);

    var REQUIRES_WATCH = "WATCH_NEEDED";
    var WINDOW_NAME = "__persona_dialog";
    var w;

    // table of registered observers
    var observers = {
      login: null,
      logout: null,
      match: null,
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

          commChan.bind('match', function(trans, params) {
            if (observers.match) observers.match();
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
          options.onmatch && typeof options.onmatch !== 'function' ||
          options.onready && typeof options.onready !== 'function')
      {
        throw new Error("non-function where function expected in parameters to navigator.id.watch()");
      }

      if (!options.onlogin) throw new Error("'onlogin' is a required argument to navigator.id.watch()");
      if (!options.onlogout) throw new Error("'onlogout' is a required argument to navigator.id.watch()");

      observers.login = options.onlogin || null;
      observers.logout = options.onlogout || null;
      observers.match = options.onmatch || null;
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
      var couldDoRedirectIfNeeded = (!needsPopupFix || api_called === 'request');

      // reset the api_called in case the site implementor changes which api
      // method called the next time around.
      api_called = null;

      options.start_time = (new Date()).getTime();

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

      function isSupported() {
        return BrowserSupport.isSupported() && couldDoRedirectIfNeeded;
      }

      function noSupportReason() {
        var reason = BrowserSupport.getNoSupportReason();
        if (!reason && !couldDoRedirectIfNeeded) {
          return REQUIRES_WATCH;
        }
      }
      
      if (!isSupported()) {
        var reason = noSupportReason();
        var url = "unsupported_dialog";

        if(reason === "LOCALSTORAGE_DISABLED") {
          url = "cookies_disabled";
        } else if (reason === REQUIRES_WATCH) {
          url = "unsupported_dialog_without_watch";
        }

        w = window.open(
          ipServer + "/" + url,
          WINDOW_NAME,
          windowOpenOpts);
        return;
      }

      // notify the iframe that the dialog is running so we
      // don't do duplicative work
      if (commChan) commChan.notify({ method: 'dialog_running' });

      function doPopupFix() {
        if (commChan) {
          return commChan.call({
            method: 'redirect_flow',
            params: JSON.stringify(options),
            success: function() {
              // use call/success so that we do not have to depend on
              // the postMessage being synchronous.
              window.location = ipServer + '/sign_in';
            }
          });
        }
      }

      if (needsPopupFix) {
        return doPopupFix();
      }

      w = WinChan.open({
        url: ipServer + '/sign_in',
        relay_url: ipServer + '/relay',
        window_features: windowOpenOpts,
        window_name: WINDOW_NAME,
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
          // prevent the authentication status check if an assertion is
          // generated in the dialog or the dialog returned with an error.
          // This prevents .onmatch from being fired for:
          // 1. assertion already generated in the dialog
          // 2. user is signed in to the site, opens the dialog, then cancels
          // the dialog without generating an assertion.
          // See #3170 & #3701
          var checkAuthStatus = !(err || r && r.assertion);
          commChan.notify({
            method: 'dialog_complete',
            params: checkAuthStatus
          });
        }

        // clear the window handle
        w = undefined;
        if (!err && r && r.assertion) {
          try {
            if (observers.login) observers.login(r.assertion);
          } catch(clientError) {
            // client's observer threw an exception
            // help developers debug by logging the error
            console.log(clientError);
            throw clientError;
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
      request: function(options) {
        if (this != navigator.id)
          throw new Error("all navigator.id calls must be made on the navigator.id object");

        if (!observers.login)
          throw new Error("navigator.id.watch must be called before navigator.id.request");

        options = options || {};
        checkCompat(false);
        api_called = "request";
        // returnTo is used for post-email-verification redirect
        if (!options.returnTo) options.returnTo = document.location.pathname;
        return internalRequest(options);
      },
      watch: function(options) {
        if (this != navigator.id)
          throw new Error("all navigator.id calls must be made on the navigator.id object");
        checkCompat(false);
        internalWatch(options);
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
        opts.backgroundColor = passedOptions.backgroundColor || undefined;
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
          observers.login = observers.logout = observers.match = observers.ready = null;
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
