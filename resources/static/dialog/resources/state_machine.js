/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */
/*global BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  var bid = BrowserID,
      storage = bid.Storage,
      mediator = bid.Mediator,
      user = bid.User,
      publish = mediator.publish.bind(mediator),
      subscriptions = [],
      stateStack = [],
      controller,
      moduleManager = bid.module,
      errors = bid.Errors,
      addPrimaryUser = false,
      email,
      requiredEmail;

  function subscribe(message, cb) {
    subscriptions.push(mediator.subscribe(message, cb));
  }

  function unsubscribeAll() {
    while(subscription = subscriptions.pop()) {
      mediator.unsubscribe(subscription);
    }
  }

  function gotoState(push, funcName) {
    var args = [].slice.call(arguments, 1);

    if (typeof push === "boolean") {
      // Must take the push param off to get to funcName and then the remaining
      // arguments.
      args = [].slice.call(args, 1);
    }
    else {
      funcName = push;
      push = true;
    }

    if (push) {
      pushState(funcName, args);
    }

    controller[funcName].apply(controller, args);
  }

  function pushState(funcName, args) {
    // Remember the state and the information for the state in case we have to
    // go back to it.
    stateStack.push({
      funcName: funcName,
      args: args
    });
  }

  // Used for when the current state is being cancelled and the user wishes to
  // go to the previous state.
  function popState() {
    // Skip the first state, it is where the user is at now.
    stateStack.pop();

    var state = stateStack[stateStack.length - 1];
    if (state) {
      controller[state.funcName].apply(controller, state.args);
    }
  }

  function startStateMachine() {
    var self = this,
        startState = gotoState.bind(self),
        cancelState = popState.bind(self);

    subscribe("offline", function(msg, info) {
      startState("doOffline");
    });

    subscribe("start", function(msg, info) {
      info = info || {};

      self.hostname = info.hostname;
      self.allowPersistent = !!info.allowPersistent;
      requiredEmail = info.requiredEmail;

      if ((typeof(requiredEmail) !== "undefined")
       && (!bid.verifyEmail(requiredEmail))) {
        // Invalid format
        startState("doError", "invalid_required_email", {email: requiredEmail});
      }
      else {
        startState("doCheckAuth");
      }
    });

    subscribe("cancel", function() {
      startState("doCancel");
    });

    subscribe("window_unload", function() {
      if (!self.success) {
        bid.Storage.setStagedOnBehalfOf("");
        startState("doCancel");
      }
    });

    subscribe("authentication_checked", function(msg, info) {
      var authenticated = info.authenticated;

      if (requiredEmail) {
        startState("doAuthenticateWithRequiredEmail", {
          email: requiredEmail
        });
      }
      else if (authenticated) {
        publish("pick_email");
      } else {
        publish("authenticate");
      }
    });

    subscribe("authenticate", function(msg, info) {
      info = info || {};

      startState("doAuthenticate", {
        email: info.email
      });
    });

    subscribe("user_staged", function(msg, info) {
      startState("doConfirmUser", info.email);
    });

    subscribe("user_confirmed", function() {
      startState("doEmailConfirmed");
    });

    subscribe("primary_user", function(msg, info) {
      addPrimaryUser = !!info.add;
      email = info.email;
      // We don't want to put the provisioning step on the stack, instead when
      // a user cancels this step, they should go back to the step before the
      // provisioning.
      var idInfo = storage.getEmail(email);
      if(idInfo && idInfo.cert) {
        mediator.publish("primary_user_ready", info);
      }
      else {
        startState(false, "doProvisionPrimaryUser", info);
      }
    });

    subscribe("primary_user_provisioned", function(msg, info) {
      info = info || {};
      info.add = !!addPrimaryUser;
      startState("doPrimaryUserProvisioned", info);
    });

    subscribe("primary_user_unauthenticated", function(msg, info) {
      info = info || {};
      info.add = !!addPrimaryUser;
      info.email = email;
      info.requiredEmail = !!requiredEmail;
      startState("doVerifyPrimaryUser", info);
    });

    subscribe("primary_user_authenticating", function(msg, info) {
      // Keep the dialog from automatically closing when the user browses to
      // the IdP for verification.
      moduleManager.stopAll();
      self.success = true;
    });

    subscribe("primary_user_ready", function(msg, info) {
      startState("doEmailChosen", info);
    });

    subscribe("pick_email", function() {
      startState("doPickEmail", {
        origin: self.hostname,
        allow_persistent: self.allowPersistent
      });
    });

    subscribe("email_chosen", function(msg, info) {
      var email = info.email
          idInfo = storage.getEmail(email);

      function complete() {
        info.complete && info.complete();
      }

      if(idInfo) {
        if(idInfo.type === "primary") {
          if(idInfo.cert) {
            startState("doEmailChosen", info);
          }
          else {
            // If the email is a primary, and their cert is not available,
            // throw the user down the primary flow.
            // Doing so will catch cases where the primary certificate is expired
            // and the user must re-verify with their IdP.  This flow will
            // generate its own assertion when ready.
            publish("primary_user", info);
          }
        }
        else {
          user.checkAuthentication(function(authentication) {
            if(authentication === "assertion") {
              // user not authenticated, kick them over to the required email
              // screen.
              startState("doAuthenticateWithRequiredEmail", {
                email: email,
                secondary_auth: true
              });
            }
            else {
              startState("doEmailChosen", info);
            }
            complete();
          }, complete);
        }
      }
      else {
        throw "invalid email";
      }
    });

    subscribe("notme", function() {
      startState("doNotMe");
    });

    subscribe("logged_out", function() {
      publish("authenticate");
    });

    subscribe("authenticated", function(msg, info) {
      mediator.publish("pick_email");
    });

    subscribe("forgot_password", function(msg, info) {
      startState("doForgotPassword", info);
    });

    subscribe("reset_password", function(msg, info) {
      startState("doConfirmUser", info.email);
    });

    subscribe("assertion_generated", function(msg, info) {
      self.success = true;
      if (info.assertion !== null) {
        startState("doAssertionGenerated", info.assertion);
      }
      else {
        startState("doPickEmail");
      }
    });

    subscribe("add_email", function(msg, info) {
      startState("doAddEmail");
    });

    subscribe("email_staged", function(msg, info) {
      startState("doConfirmEmail", info.email);
    });

    subscribe("email_confirmed", function() {
      startState("doEmailConfirmed");
    });

    subscribe("cancel_state", function(msg, info) {
      cancelState();
    });

  }

  var StateMachine = BrowserID.Class({
    init: function() {
      // empty
    },

    start: function(options) {
      options = options || {};

      controller = options.controller;
      if (!controller) {
        throw "start: controller must be specified";
      }

      startStateMachine.call(this);
    },

    stop: function() {
      unsubscribeAll();
    }
  });


  bid.StateMachine = StateMachine;
}());

