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
(function() {
  var bid = BrowserID,
      user = bid.User,
      mediator = bid.Mediator,
      subscriptions = [],
      stateStack = [];

  function subscribe(message, cb) {
    subscriptions.push(mediator.subscribe(message, cb));
  }

  function unsubscribeAll() {
    while(subscription = subscriptions.pop()) {
      mediator.unsubscribe(subscription);
    }
  }

  function pushState(funcName) {
    var args = [].splice.call(arguments, 1),
        controller = this.controller;

    // Remember the state and the information for the state in case we have to 
    // go back to it.
    stateStack.push({
      funcName: funcName,
      args: args
    });

    controller[funcName].apply(controller, args);
  }

  // Used for when the current state is being cancelled and the user wishes to 
  // go to the previous state.
  function popState() {
    // Skip the first state, it is where the user is at now.
    stateStack.pop();

    // When popping, go to the second state back.
    var gotoState = stateStack[stateStack.length - 1];

    if(gotoState) {
      var controller = this.controller;
      controller[gotoState.funcName].apply(controller, gotoState.args);
    }
  }

  function startStateMachine() {
    var self = this,
        controller = self.controller,
        gotoState = pushState.bind(self),
        cancelState = popState.bind(self);
       
    subscribe("offline", function(msg, info) {
      gotoState("doOffline");
    });

    subscribe("cancel_state", function(msg, info) {
      cancelState();
    });

    subscribe("user_staged", function(msg, info) {
      gotoState("doConfirmUser", info.email);
    });

    subscribe("user_confirmed", function() {
      gotoState("doEmailConfirmed");
    });

    subscribe("pick_email", function() {
      gotoState("doPickEmail");
    });

    subscribe("authenticated", function(msg, info) {
      gotoState("doSyncThenPickEmail");
    });

    subscribe("forgot_password", function(msg, info) {
      gotoState("doForgotPassword", info.email);
    });

    subscribe("reset_password", function(msg, info) {
      gotoState("doConfirmUser", info.email);
    });

    subscribe("assertion_generated", function(msg, info) {
      if (info.assertion !== null) {
        gotoState("doAssertionGenerated", info.assertion);
      }
      else {
        gotoState("doPickEmail");
      }
    });

    subscribe("add_email", function(msg, info) {
      gotoState("doAddEmail");
    });

    subscribe("email_staged", function(msg, info) {
      gotoState("doConfirmEmail", info.email);
    });

    subscribe("email_confirmed", function() {
      gotoState("doEmailConfirmed");
    });

    subscribe("notme", function() {
      gotoState("doNotMe");
    });

    subscribe("auth", function(msg, info) {
      info = info || {};

      gotoState("doAuthenticate", {
        email: info.email
      });
    });

    subscribe("start", function() {
      gotoState("doCheckAuth");
    });

    subscribe("cancel", function() {
      gotoState("doCancel");
    });
  }

  var StateMachine = BrowserID.Class({
    init: function() { 
      // empty
    },

    start: function(options) {
      options = options || {};
      this.controller = options.controller;
      startStateMachine.call(this);
    }, 

    stop: function() {
      unsubscribeAll();
    }
  });


  bid.StateMachine = StateMachine;
}());

