/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


BrowserID.Modules.Dialog = (function() {
  "use strict";

  var bid = BrowserID,
      user = bid.User,
      errors = bid.Errors,
      dom = bid.DOM,
      helpers = bid.Helpers,
      storage = bid.Storage,
      win = window,
      startExternalDependencies = true,
      channel,
      sc;

  function startActions(onsuccess, onerror) {
    var actions = BrowserID.Modules.Actions.create();
    actions.start({
      onsuccess: onsuccess,
      onerror: onerror
    });
    return actions;
  }

  function startStateMachine(controller) {
    // start this directly because it should always be running.
    var machine = BrowserID.State.create();
    machine.start({
      controller: controller
    });
  }

  function startChannel() {
    /*jshint validthis: true*/
    var self = this,
        hash = win.location.hash;

    // first, we see if there is a local channel
    if (win.navigator.id && win.navigator.id.channel) {
      win.navigator.id.channel.registerController(self);
      return;
    }

    // returning from the primary verification flow, we were native before, we
    // are native now. This prevents the UI from trying to establish a channel
    // back to the RP.
    try {
      var info = storage.idpVerification.get();
      /*jshint sub: true */
      if (info && info['native']) return;
    } catch(e) {
      self.renderError("error", {
        action: {
          title: "error in localStorage",
          message: "could not decode localStorage: " + String(e)
        }
      });
    }

    // next, we see if the caller intends to call native APIs
    if (hash === "#NATIVE" || hash === "#INTERNAL") {
      // don't do winchan, let it be.
      return;
    }

    try {
      channel = WinChan.onOpen(function(origin, args, cb) {
        // XXX this is called whenever the primary provisioning iframe gets
        // added.  If there are no args, then do not do self.get.
        if(args) {
          self.get(origin, args.params, function(r) {
            cb(r);
          }, function (e) {
            cb(null);
          });
        }
      });
    } catch (e) {
      self.renderError("error", {
        action: errors.relaySetup
      });
    }
  }

  function stopChannel() {
    channel && channel.detach();
  }

  function onWindowUnload() {
    /*jshint validthis: true*/
    this.publish("window_unload");
  }

  function fixupURL(origin, url) {
    var u;
    if (typeof(url) !== "string")
      throw new Error("urls must be strings: (" + url + ")");
    /*jshint newcap:false*/
    if (/^http(s)?:\/\//.test(url)) u = URLParse(url);
    else if (/^\/[^\/]/.test(url)) u = URLParse(origin + url);
    else throw new Error("relative urls not allowed: (" + url + ")");
    // encodeURI limits our return value to [a-z0-9:/?%], excluding <script>
    var encodedURI = encodeURI(u.validate().normalize().toString());

    // All browsers have a max length of URI that they can handle. IE8 has the
    // shortest total length at 2083 bytes.  IE8 can handle a path length of
    // 2048 bytes. See http://support.microsoft.com/kb/q208427

    // Check the total encoded URI length
    if (encodedURI.length > bid.URL_MAX_LENGTH)
      throw new Error("urls must be < " + bid.URL_MAX_LENGTH + " characters");

    // Check just the path portion.  encode the path to make sure the full
    // length is checked.
    if (encodeURI(u.path).length > bid.PATH_MAX_LENGTH)
      throw new Error("path portion of a url must be < " + bid.PATH_MAX_LENGTH + " characters");

    return encodedURI;
  }

  function fixupAbsolutePath(origin_url, path) {
    // Ensure URL is an absolute path (not a relative path or a scheme-relative URL)
    if (/^\/[^\/]/.test(path))  return fixupURL(origin_url, path);

    throw new Error("must be an absolute path: (" + path + ")");
  }

  function fixupReturnTo(origin_url, path) {
    // "/" is a valid returnTo, but it is not a valid path for any other
    // parameter. If the path is "/", allow it, otherwise pass the path down
    // the normal checks.
    var returnTo = path === "/" ?
      origin_url + path :
      fixupAbsolutePath(origin_url, path);
    return returnTo;
  }

  function fixupIssuer(issuer) {
    // An issuer should not have a scheme on the front of it.
    // The URL parser requires a scheme. Prepend the scheme to do the
    // verification.
    /*jshint newcap:false*/
    var u = URLParse("http://" + issuer);
    if (u.host !== issuer) {
      var encodedURI = encodeURI(u.validate().normalize().toString());
      throw new Error("invalid issuer: " + encodedURI);
    }

    return issuer;
  }

  function validateBackgroundColor(value) {

    if (value.substr(0, 1) === '#') {
      value = value.substr(1);
    }

    // Check if this is valid hex color
    if (!value.match(/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/)) {
      throw new Error('invalid backgroundColor: ' + value);
    }

    if (value.length === 6) {
      return value;
    }

    // Normalize 3- to 6-character hex color
    var bits = [];
    for (var i = 0; i < 3; i++) {
      bits.push(value.charAt(i) + value.charAt(i));
    }

    return bits.join('');

  }

  function validateRPAPI(rpAPI) {
    var VALID_RP_API_VALUES = [
      "watch_without_onready",
      "watch_with_onready",
      "get",
      "getVerifiedEmail",
      "internal"
    ];

    if (_.indexOf(VALID_RP_API_VALUES, rpAPI) === -1) {
      throw new Error("invalid value for rp_api: " + rpAPI);
    }
  }

  function validateStartTime(startTime) {
    var parsedTime = parseInt(startTime, 10);
    if (typeof parsedTime !== "number" || isNaN(parsedTime)) {
      throw new Error("invalid value for start_time: " + startTime);
    }

    return parsedTime;
  }

  function validateBoolean(bool, name) {
    if (typeof bool !== "boolean") {
      throw new Error("invalid value for " + name + ": " + bool);
    }

    return bool;
  }

  var Dialog = bid.Modules.PageModule.extend({
    start: function(options) {
      var self=this;

      options = options || {};

      win = options.window || window;

      // startExternalDependencies is used in unit testing and can only be set
      // by the creator/starter of this module.  If startExternalDependencies
      // is set to false, the channel, state machine, and actions controller
      // are not started.  These dependencies can interfere with the ability to
      // unit test this module because they can throw exceptions and show error
      // messages.
      startExternalDependencies = true;
      if (typeof options.startExternalDependencies === "boolean") {
        startExternalDependencies = options.startExternalDependencies;
      }

      sc.start.call(self, options);

      if (startExternalDependencies) {
        startChannel.call(self);
      }

      options.ready && _.defer(options.ready);
    },

    stop: function() {
      stopChannel();
      sc.stop.call(this);
    },

    get: function(origin_url, paramsFromRP, success, error) {
      var self=this,
          hash = win.location.hash;

      user.setOrigin(origin_url);

      // By default, a dialog is an orphan. It is only not an orphan if an
      // assertion is generated. When an asseriton is generated, orphaned will
      // be set to false (currently in state.js).
      var kpis = {
        orphaned: true
      };


      if (startExternalDependencies) {
        var actions = startActions.call(self, success, error);
        startStateMachine.call(self, actions);
      }

      // Security Note: paramsFromRP is the output of a JSON.parse on an
      // RP-controlled string. Most of these fields are expected to be simple
      // printable strings (hostnames, usernames, and URLs), but we cannot
      // rely upon the RP to do that. In particular we must guard against
      // these strings containing <script> tags. We will populate a new
      // object ("params") with suitably type-checked properties.
      var params = {};
      params.hostname = user.getHostname();

      // verify params
      try {
        var startTime = paramsFromRP.start_time;
        if (startTime) {
          startTime = validateStartTime(startTime);
          self.publish("start_time", startTime);
        }

        self.publish("channel_established");

        var rpAPI = paramsFromRP.rp_api;
        if (rpAPI) {
          // throws if an invalid rp_api value
          validateRPAPI(rpAPI);
          kpis.rp_api = rpAPI;
        }

        if (paramsFromRP.requiredEmail) {
          helpers.log("requiredEmail has been deprecated");
        }

        // support old parameter names if new parameter names not defined.
        if (paramsFromRP.tosURL && !paramsFromRP.termsOfService)
          paramsFromRP.termsOfService = paramsFromRP.tosURL;

        if (paramsFromRP.privacyURL && !paramsFromRP.privacyPolicy)
          paramsFromRP.privacyPolicy = paramsFromRP.privacyURL;

        if (paramsFromRP.termsOfService && paramsFromRP.privacyPolicy) {
          params.termsOfService = fixupURL(origin_url, paramsFromRP.termsOfService);
          params.privacyPolicy = fixupURL(origin_url, paramsFromRP.privacyPolicy);
        }

        if (paramsFromRP.siteLogo) {
          // Until we have our head around the dangers of data uris and images
          // that come from other domains, only allow absolute paths from the
          // origin.
          params.siteLogo = fixupAbsolutePath(origin_url, paramsFromRP.siteLogo);
          // To avoid mixed content errors, only allow siteLogos to be served
          // from https RPs
          /*jshint newcap:false*/
          if (URLParse(origin_url).scheme !== "https") {
            throw new Error("only https sites can specify a siteLogo");
          }
        }

        if (paramsFromRP.backgroundColor) {
          var backgroundColor = validateBackgroundColor(paramsFromRP.backgroundColor);
          if (backgroundColor) params.backgroundColor = backgroundColor;
        }

        if (paramsFromRP.siteName) {
          params.siteName = _.escape(paramsFromRP.siteName);
        }

        // returnTo is used for post verification redirection.  Redirect back
        // to the path specified by the RP.
        if (paramsFromRP.returnTo) {
          var returnTo = fixupReturnTo(origin_url, paramsFromRP.returnTo);
          user.setReturnTo(returnTo);
        }

        // forceAuthentication is used by the Marketplace to ensure that the
        // user knows the password to this account. We ignore any active session.
        if (paramsFromRP.experimental_forceAuthentication) {
          params.forceAuthentication = validateBoolean(
              paramsFromRP.experimental_forceAuthentication,
              "experimental_forceAuthentication");
        }

        // forceIsuser is used by the Marketplace to disable primary support
        // and replace fxos.login.persona.org as the issuer of certs
        if (paramsFromRP.experimental_forceIssuer) {
          params.forceIssuer =
              fixupIssuer(paramsFromRP.experimental_forceIssuer);
        }

        // allowUnverified means that the user doesn't need to have
        // verified their email address in order to send an assertion.
        // if the user *has* verified, it will be a verified assertion.
        if (paramsFromRP.experimental_allowUnverified) {
          params.allowUnverified = validateBoolean(
              paramsFromRP.experimental_allowUnverified,
              "experimental_allowUnverified");
        }

        if (hash.indexOf("#AUTH_RETURN") === 0) {
          var primaryParams = storage.idpVerification.get();
          if (!primaryParams)
            throw new Error("Could not get IdP Verification Info");

          params.email = primaryParams.email;
          params.add = primaryParams.add;
          params.type = "primary";

          // FIXME: if it's AUTH_RETURN_CANCEL, we should short-circuit
          // the attempt at provisioning. For now, we let provisioning
          // be tried and fail.
        }

        // no matter what, we clear the primary flow state for this window
        storage.idpVerification.clear();
      } catch(e) {
        // note: renderError accepts HTML and cheerfully injects it into a
        // frame with a powerful origin. So convert 'e' first.
        self.renderError("error", {
          action: {
            title: "error in " + _.escape(origin_url),
            message: "improper usage of API: " + _.escape(e)
          }
        });

        return e;
      }
      // after this point, "params" can be relied upon to contain safe data

      // XXX Perhaps put this into the state machine.
      self.bind(win, "unload", onWindowUnload);

      function start() {
        self.publish("start", params);
      }

      // only publish the kpi's in aggregate.
      self.publish("kpi_data", kpis);

      if (params.type === "primary" && !params.add) {
        // at this point, we will only have type of primary if we're
        // returning from #AUTH_RETURN. Mark that email as having been
        // used as a primary, in case it used to be a secondary.
        // If being added, the user doesn't own this email yet, and the
        // status will be changed in add_email_with_assertion.
        //
        // NOTE: calling start for a request failure is the desired behavior.
        // If this call fails, it is no big deal, the user should not be
        // blocked. See
        // https://github.com/mozilla/browserid/issues/2840#issuecomment-11215155
        user.usedAddressAsPrimary(params.email, start, start);
      } else {
        start();
      }
    }

    // BEGIN TESTING API
    ,
    onWindowUnload: onWindowUnload
    // END TESTING API

  });

  sc = Dialog.sc;

  return Dialog;

}());
