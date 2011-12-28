/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global BrowserID: true */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla BrowserID.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */


BrowserID.Modules.Dialog = (function() {
  "use strict";

  var bid = BrowserID,
      user = bid.User,
      errors = bid.Errors,
      dom = bid.DOM,
      win = window,
      channel,
      sc;

  function checkOnline() {
    if (false && 'onLine' in navigator && !navigator.onLine) {
      this.publish("offline");
      return false;
    }

    return true;
  }

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
    var machine = BrowserID.StateMachine.create();
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

      if(checkOnline.call(self)) {
        params = params || {};

        params.hostname = user.getHostname();

        // XXX Perhaps put this into the state machine.
        self.bind(win, "unload", onWindowUnload);
        if(hash.indexOf("#CREATE_EMAIL=") === 0) {
          var email = hash.replace(/#CREATE_EMAIL=/, "");
          self.renderDialog("primary_user_verified", { email: email });
          self.close("primary_user", { email: email, add: false });
        }
        else if(hash.indexOf("#ADD_EMAIL=") === 0) {
          var email = hash.replace(/#ADD_EMAIL=/, "");
          self.renderDialog("primary_user_verified", { email: email });
          self.close("primary_user", { email: email, add: true });
        }
        else {
          self.publish("start", params);
        }
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
