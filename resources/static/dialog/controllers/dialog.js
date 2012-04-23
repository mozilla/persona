/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


BrowserID.Modules.Dialog = (function() {
  "use strict";

  var bid = BrowserID,
      user = bid.User,
      errors = bid.Errors,
      dom = bid.DOM,
      win = window,
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
    var self = this,
        hash = win.location.hash;

    // first, we see if there is a local channel
    if (win.navigator.id && win.navigator.id.channel) {
      win.navigator.id.channel.registerController(self);
      return;
    }

    // next, we see if the caller intends to call native APIs
    if (hash == "#NATIVE" || hash == "#INTERNAL") {
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

  function setOrigin(origin) {
    user.setOrigin(origin);
    dom.setInner("#sitename", user.getHostname());
  }

  function onWindowUnload() {
    this.publish("window_unload");
  }

  function fixupURL(origin, url) {
    var u;
    if (/^http/.test(url)) u = URLParse(url);
    else if (/^\//.test(url)) u = URLParse(origin + url);
    else throw "relative urls not allowed: (" + url + ")";
    return encodeURI(u.validate().normalize().toString());
  }

  var Dialog = bid.Modules.PageModule.extend({
    start: function(options) {
      var self=this;

      options = options || {};

      win = options.window || window;

      sc.start.call(self, options);
      startChannel.call(self);
      options.ready && _.defer(options.ready);
    },

    stop: function() {
      stopChannel();
      sc.stop.call(this);
    },

    getVerifiedEmail: function(origin_url, success, error) {
      return this.get(origin_url, {}, success, error);
    },

    get: function(origin_url, params, success, error) {
      var self=this,
          hash = win.location.hash;

      setOrigin(origin_url);

      var actions = startActions.call(self, success, error);
      startStateMachine.call(self, actions);

      params = params || {};
      params.hostname = user.getHostname();

      // verify params
      if (params.tosURL && params.privacyURL) {
        try {
          params.tosURL = fixupURL(origin_url, params.tosURL);
          params.privacyURL = fixupURL(origin_url, params.privacyURL);
        } catch(e) {
          return self.renderError("error", {
            action: {
              title: "error in " + origin_url,
              message: "improper usage of API: " + e
            }
          });
        }
      }

      // XXX Perhaps put this into the state machine.
      self.bind(win, "unload", onWindowUnload);

      if(hash.indexOf("#CREATE_EMAIL=") === 0) {
        var email = hash.replace(/#CREATE_EMAIL=/, "");
        params.type = "primary";
        params.email = email;
        params.add = false;
      }
      else if(hash.indexOf("#ADD_EMAIL=") === 0) {
        var email = hash.replace(/#ADD_EMAIL=/, "");
        params.type = "primary";
        params.email = email;
        params.add = true;
      }

      self.publish("start", params);
    }

    // BEGIN TESTING API
    ,
    onWindowUnload: onWindowUnload
    // END TESTING API

  });

  sc = Dialog.sc;

  return Dialog;

}());
