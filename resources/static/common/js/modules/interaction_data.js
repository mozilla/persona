/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * interaction_data is a module responsible for collecting and
 * reporting anonymous interaction data that represents a user's
 * interaction with the dialog.  It aggregates information that is not
 * user specific like the user's OS, Browser, and the interface
 * elements they've clicked on.  It stores this information in
 * localstorage, and at initialization reports previous interaction
 * data to the server.  This data is then used to optimize the user
 * experience of the Persona dialog.
 *
 * More information about interaction data and 'Key Performance Indicators'
 * stats that are derived from it:
 *
 *  https://wiki.mozilla.org/Privacy/Reviews/KPI_Backend
 */

// TODO:
//  * should code explicitly call .addEvent?  or instead should this module
//    listen for events via the mediator?

BrowserID.Modules.InteractionData = (function() {
  "use strict";

  var bid = BrowserID,
      model = bid.Models.InteractionData,
      network = bid.Network,
      storage = bid.Storage,
      complete = bid.Helpers.complete,
      dom = bid.DOM,
      sc;

  /**
   * This is a translation table from a message on the mediator to a KPI name.
   * Names can be modified or added to the KPI storage directly.
   * A name can be translated by using either a string or a function.
   *
   * value side contains - purpose
   * null - no translation, use mediator name for KPI name.
   * string - translate from mediator name to string.
   * function - function takes two arguments, msg and data.  These come
   *   directly from the mediator.  Function returns a value.  If no value is
   *   returned, field will not be saved to KPI data set.
   */

  /**
   * Explanation of KPIs:
   *
   * screen.* - the user sees a new screen (generally speaking, though there
   *   may be a couple of exceptions).
   * window.redirect_to_primary - the user has to authenticate with their
   *   IdP so they are being redirected away.
   * window.unload - the last thing in every event stream.
   * generate_assertion - the order was given to generate an assertion.
   * assertion_generated - the assertion generation is complete -
   *   these two together are useful to measure how long crypto is taking
   *   on various devices.
   * user.user_staged - a new user verification email is sent
   * user.user_confirmed - the user has confirmed and the dialog is closing.
   *   These two together give us the info needed to see how long it takes
   *   users to confirm their address - iff they keep their dialog open.
   * user.email_staged/user.email_confirmed is similar to
   *   user.user_staged/confirmed except it is when the user adds a secondary
   *   email to their account.
   * user.logout - that is the user has clicked "this is not me."
   */

  var MediatorToKPINameTable = {
    service: function(msg, data) { return "screen." + data.name; },
    cancel_state: "screen.cancel",
    primary_user_authenticating: "window.redirect_to_primary",
    window_unload: "window.unload",
    generate_assertion: null,
    assertion_generated: null,
    user_staged: "user.user_staged",
    user_confirmed: "user.user_confirmed",
    email_staged: "user.email_staged",
    email_confirmed: "user.email_confrimed",
    notme: "user.logout",
    enter_password: "authenticate.enter_password",
    password_submit: "authenticate.password_submitted",
    authentication_success: "authenticate.password_success",
    authentication_fail: "authenticate.password_fail"
  };

  function getKPIName(msg, data) {
    var self=this,
        kpiInfo = self.mediatorToKPINameTable[msg];

    var type = typeof kpiInfo;
    if(kpiInfo === null) return msg;
    if(type === "string") return kpiInfo;
    if(type === "function") return kpiInfo(msg, data);
  }

  function onSessionContext(msg, result) {
    var self=this;

    // defend against onSessionContext being called multiple times
    if (self.sessionContextHandled) return;
    self.sessionContextHandled = true;

    publishPreviousSession.call(self, result);
  }

  function publishPreviousSession(result) {
    // Publish any outstanding data.  Unless this is a continuation, previous
    // session data must be published independently of whether the current
    // dialog session is allowed to sample data. This is because the original
    // dialog session has already decided whether to collect data.
    //
    // beginSampling must happen afterwards, since we need to send and
    // then scrub out the previous sessions data.

    var self = this;

    function onComplete() {
      model.stageCurrent();
      publishStored.call(self);
      beginSampling.call(self, result);
    }

    // if we were orphaned last time, but user is now authenticated,
    // lets see if their action end in success, and if so,
    // remove the orphaned flag
    //
    // actions:
    // - user_staged => is authenticated?
    // - email_staged => email count is higher?
    //
    // See https://github.com/mozilla/browserid/issues/1827
    var current = model.getCurrent();
    if (current && current.orphaned) {
      var events = current.event_stream || [];
      if (hasEvent(events, MediatorToKPINameTable.user_staged)) {
        network.checkAuth(function(auth) {
          if (!!auth) {
            current.orphaned = false;
            model.setCurrent(current);
          }
          complete(onComplete);
        });
      } else if (hasEvent(events, MediatorToKPINameTable.email_staged)) {
        if ((storage.getEmailCount() || 0) > (current.number_emails || 0)) {
          current.orphaned = false;
          model.setCurrent(current);
        }
        complete(onComplete);
      } else {
        // oh well, an orphan it is
        complete(onComplete);
      }
    } else {
      // not an orphan, move along
      complete(onComplete);
    }
  }

  function beginSampling(result) {
    var self = this;

    // set the sample rate as defined by the server.  It's a value
    // between 0..1, integer or float, and it specifies the percentage
    // of the time that we should capture
    var sampleRate = result.data_sample_rate || 0;

    if (typeof self.samplingEnabled === "undefined") {
      // now that we've got sample rate, let's smash it into a boolean
      // probalistically
      self.samplingEnabled = Math.random() <= sampleRate;
    }

    // if we're not going to sample, kick out early.
    if (!self.samplingEnabled) {
      return;
    }

    // server_time is sent in milliseconds. The promise to users and data
    // safety is the timestamp would be at a 10 minute resolution.  Round to the
    // previous 10 minute mark.
    var TEN_MINS_IN_MS = 10 * 60 * 1000,
        roundedServerTime = Math.floor(result.server_time / TEN_MINS_IN_MS) * TEN_MINS_IN_MS;

    var currentData = {
      event_stream: self.initialEventStream,
      sample_rate: sampleRate,
      timestamp: roundedServerTime,
      local_timestamp: self.startTime.toString(),
      lang: dom.getAttr('html', 'lang') || null,
    };

    if (window.screen) {
      currentData.screen_size = {
        width: window.screen.width,
        height: window.screen.height
      };
    }

    // cool.  now let's persist the initial data.  This data will be published
    // as soon as the first session_context completes for the next dialog
    // session.  Use a push because old data *may not* have been correctly
    // published to a down server or erroring web service.
    model.push(currentData);

    self.initialEventStream = null;

    self.samplesBeingStored = true;

  }

  function indexOfEvent(eventStream, eventName) {
    for(var event, i = 0; event = eventStream[i]; ++i) {
      if(event[0] === eventName) return i;
    }

    return -1;
  }

  function hasEvent(eventStream, eventName) {
    return indexOfEvent(eventStream, eventName) !== -1;
  }

  function onKPIData(msg, result) {
    // currentData will be undefined if sampling is disabled.
    var currentData = this.getCurrent();
    if (currentData) {
      _.extend(currentData, result);
      model.setCurrent(currentData);
    }
  }

  // At every load, after session_context returns, try to publish the previous
  // data.  We have to wait until session_context completes so that we have
  // a csrf token to send.
  function publishStored(oncomplete) {
    var self=this;

    model.publishStaged(function(status) {
      var msg = status ? "interaction_data_send_complete" : "interaction_data_send_error";
      self.publish(msg);
      complete(oncomplete, status);
    });
  }


  function addEvent(msg, data) {
    var self=this;
    if (self.samplingEnabled === false) return;

    var eventName = getKPIName.call(self, msg, data);
    if (!eventName) return;

    var eventData = [ eventName, new Date() - self.startTime ];
    if (self.samplesBeingStored) {
      var d = model.getCurrent() || {};
      if (!d.event_stream) d.event_stream = [];
      d.event_stream.push(eventData);
      model.setCurrent(d);
    } else {
      self.initialEventStream.push(eventData);
    }
  }

  function getCurrent() {
    var self=this;
    if(self.samplingEnabled === false) return;

    if (self.samplesBeingStored) {
      return model.getCurrent();
    }
  }

  function getCurrentEventStream() {
    var self=this;
    if(self.samplingEnabled === false) return;

    if (self.samplesBeingStored) {
      return model.getCurrent().event_stream;
    }
    else {
      return self.initialEventStream;
    }
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      options = options || {};

      var self = this;
      self.mediatorToKPINameTable = MediatorToKPINameTable;

      // options.samplingEnabled is used for testing purposes.
      //
      // If samplingEnabled is not specified in the options, and this is not
      // a continuation, samplingEnabled will be decided on the first "
      // context_info" event, which corresponds to the first time
      // 'session_context' returns from the server.
      // samplingEnabled flag ignored for a continuation.
      self.samplingEnabled = options.samplingEnabled;

      // continuation means the users dialog session is continuing, probably
      // due to a redirect to an IdP and then a return after authentication.
      if (options.continuation) {
        // There will be no current data if the previous session was not
        // allowed to save.
        var previousData = model.getCurrent();
        if (previousData) {
          self.startTime = Date.parse(previousData.local_timestamp);


          // instead of waiting for session_context to start appending data to
          // localStorage, start saving into localStorage now.
          self.samplingEnabled = self.samplesBeingStored = true;
        }
        else {
          // If there was no previous data, that means data collection
          // was not allowed for the previous session.  Return with no further
          // action, data collection is not allowed for this session either.
          self.samplingEnabled = false;
          return;
        }
      }
      else {
        self.startTime = new Date();

        // The initialEventStream is used to store events until onSessionContext
        // is called.  Once onSessionContext is called and it is known whether
        // the user's data will be saved, initialEventStream will either be
        // discarded or added to the data set that is saved to localmodel.
        self.initialEventStream = [];
        self.samplesBeingStored = false;

        // whenever session_context is hit, let's hear about it so we can
        // extract the information that's important to us (like, whether we
        // should be running or not)
        self.subscribe('context_info', onSessionContext);
      }

      // on all events, update event_stream
      self.subscribeAll(addEvent);
      self.subscribe('kpi_data', onKPIData);
    },

    addEvent: addEvent,
    getCurrent: getCurrent,
    getCurrentEventStream: getCurrentEventStream,
    publishStored: publishStored

    // BEGIN TEST API
    ,
    setNameTable: function(table) {
      this.mediatorToKPINameTable = table;
    },

    enable: function() {
      this.samplingEnabled = true;
    },

    disable: function() {
      this.samplingEnabled = false;
    }
    // END TEST API
  });

  sc = Module.sc;

  return Module;

}());
