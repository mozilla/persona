/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


BrowserID.Modules.Dialog = (function() {
  "use strict";

  var bid = BrowserID,
      user = bid.User,
      errors = bid.Errors,
      storage = bid.Storage,
      sc;

  function startActions(onsuccess, onerror) {
    /*jshint validthis: true*/
    var actions = this.actions = bid.Modules.Actions.create();
    actions.start({
      onsuccess: onsuccess,
      onerror: onerror
    });
  }

  function startStateMachine() {
    /*jshint validthis: true*/
    // start this directly because it should always be running.
    var machine = this.stateMachine = bid.State.create();
    machine.start({
      controller: this.actions
    });
  }

  function startValidator() {
    /*jshint validthis: true*/
    var validator = this.validator = bid.Modules.ValidateRpParams.create();
    validator.start({
      window: this.window
    });
  }

  function startChannel() {
    /*jshint validthis: true*/
    var self = this,
        established,
        err;

    try {
      // Native goes before anything. Next, WinChan. If WinChan fails, try the
      // workaround for environments that do not support popups.
      established = tryNativeChannel.call(self)
                 || tryWinChan.call(self)
                 || tryRpRedirect.call(self);
    }
    catch(e) {
      // generic error message displayed below
      err = e;
    }

    if (!established) {
      var errorInfo = { action: errors.relaySetup };
      if (err) errorInfo.message = String(err);
      self.renderError("error", errorInfo);
    }
  }

  function tryNativeChannel() {
    /*jshint validthis: true*/
    var self = this,
        win = self.window,
        hash = win.location.hash;

    // first, we see if there is a local channel
    if (win.navigator.id && win.navigator.id.channel) {
      win.navigator.id.channel.registerController(self);
      return true;
    }

    // returning from the primary verification flow, we were native before, we
    // are native now. This prevents the UI from trying to establish a channel
    // back to the RP.
    try {
      var info = storage.idpVerification.get();
      /*jshint sub: true */
      if (info && info['native']) return true;
    } catch(e) {
      self.renderError("error", {
        action: {
          title: "error in localStorage",
          message: "could not decode localStorage: " + String(e)
        }
      });

      return true;
    }

    // next, we see if the caller intends to call native APIs
    return (hash === "#NATIVE" || hash === "#INTERNAL");
  }

  function tryWinChan() {
    /*jshint validthis: true*/
    var self = this;

    try {
      self.channel = WinChan.onOpen(function(origin, args, cb) {
        // XXX this is called whenever the primary provisioning iframe gets
        // added.  If there are no args, then do not do self.get.
        if (args) {
          self.get(origin, args.params, function(r) {
            cb(r);
          }, function (e) {
            cb(null);
          });
        }
      });
    } catch(e) {
      // don't do anything, we'll try the redirect flow next.
    }

    return !!self.channel;
  }

  function tryRpRedirect() {
    /*jshint validthis: true*/
    // If there was an error opening the WinChan, we have a potential
    // workaround. We let WinChan try first always, to prevent the
    // redirect flow happening in an environment where popups work just fine.
    var self = this;
    var rpInfo;
    try {
      rpInfo = storage.rpRequest.get();
    } catch(e) {
      this.renderError("error", {
        action: {
          title: "error in sessionStorage",
          message: "could not decode sessionStorage: " + String(e)
        }
      });

      return true;
    }

    if (rpInfo) {
      var done = function done() {
        redirectFlowComplete(self.window, user.getReturnTo());
      };
      this.get(rpInfo.origin, rpInfo.params, done, done);
      return true;
    }
  }

  function redirectFlowComplete(win, returnTo) {
    /**
     * clear the rpRequest info to prevent users who have visited the dialog
     * from re-starting the dialog flow by typing the dialog's URL into the
     * address bar.
     */
    storage.rpRequest.clear();
    win.location = returnTo;
  }

  function onWindowUnload() {
    /*jshint validthis: true*/
    this.publish("window_unload");
  }

  function publishKpis(rpAPI) {
    /*jshint validthis: true*/

    // By default, a dialog is an orphan. It is only not an orphan if an
    // assertion is generated. When an assertion is generated, orphaned will
    // be set to false (currently in state.js).
    var kpis = {
      orphaned: true,
      rp_api: rpAPI || "unknown"
    };

    // only publish the kpi's in aggregate.
    this.publish("kpi_data", kpis);
  }

  function validateRpParams(originURL, paramsFromRP) {
    /*jshint validthis: true*/
    var self=this;

    startValidator.call(self);

    var params;
    try {
      paramsFromRP.originURL = originURL;
      params = self.validator.validate(paramsFromRP);
    } catch(e) {
      // note: renderError accepts HTML and cheerfully injects it into a
      // frame with a powerful origin. So convert 'e' first.
      self.renderError("error", {
        action: {
          title: "error in " + _.escape(originURL),
          message: "improper usage of API: " + _.escape(e)
        }
      });

      throw e;
    }

    return params;
  }


  var Dialog = bid.Modules.PageModule.extend({
    start: function(options) {
      var self=this;

      options = options || {};

      self.window = options.window || window;

      // startExternalDependencies is used in unit testing and can only be set
      // by the creator/starter of this module.  If startExternalDependencies
      // is set to false, the channel, state machine, and actions controller
      // are not started.  These dependencies can interfere with the ability to
      // unit test this module because they can throw exceptions and show error
      // messages.
      self.startExternalDependencies = true;
      if (typeof options.startExternalDependencies === "boolean") {
        self.startExternalDependencies = options.startExternalDependencies;
      }

      sc.start.call(self, options);

      if (self.startExternalDependencies) {
        startChannel.call(self);
      }

      options.ready && _.defer(options.ready);
    },

    stop: function() {
      var self=this;
      if (self.channel)
        self.channel.detach();

      if (self.actions)
        self.actions.stop();

      if (self.validator)
        self.validator.stop();

      sc.stop.call(this);
    },

    get: function(originURL, paramsFromRP, success, error) {
      var self=this;

      user.setOrigin(originURL);

      if (self.startExternalDependencies) {
        startActions.call(self, success, error);
        startStateMachine.call(self);
      }

      var params;
      try {
        params = validateRpParams.call(self, originURL, paramsFromRP);
      } catch(e) {
        // input parameter validation failure. Stop.
        return e;
      }

      // after this point, "params" and "paramsFromRP" can be relied upon
      // to contain safe data

      params.hostname = user.getHostname();

      if (params.startTime)
        self.publish("start_time", params.startTime);

      publishKpis.call(self, params.rpAPI);

      if (params.returnTo)
        user.setReturnTo(params.returnTo);


      // XXX Perhaps put this into the state machine.
      self.bind(self.window, "unload", onWindowUnload);

      self.publish("channel_established");

      // no matter what, we clear the primary flow state for this window
      storage.idpVerification.clear();

      function start() {
        self.publish("start", params);
      }

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
