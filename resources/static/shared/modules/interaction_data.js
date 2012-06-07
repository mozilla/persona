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
  var bid = BrowserID,
      model = bid.Models.InteractionData,
      network = bid.Network,
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
  var MediatorToKPINameTable = {
    service: function(msg, data) { return "screen." + data.name; },
    cancel_state: "screen.cancel",
    primary_user_authenticating: "window.redirect_to_primary",
    window_unload: "window.unload",
    generate_assertion: null,
    assertion_generated: null,
    emails_displayed: function(msg, data) { return "user.email_count:" + data.count; },
    user_staged: "user.user_staged",
    user_confirmed: "user.user_confirmed",
    email_staged: "user.email_staged",
    email_confirmed: "user.email_confrimed",
    notme: "user.logout",
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

    // Publish any outstanding data.  Unless this is a continuation, previous
    // session data must be published independently of whether the current
    // dialog session is allowed to sample data. This is because the original
    // dialog session has already decided whether to collect data.

    model.stageCurrent();
    publishStored.call(self);

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

    var currentData = {
      event_stream: self.initialEventStream,
      sample_rate: sampleRate,
      timestamp: result.server_time,
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
        self.contextInfoHandle = this.subscribe('context_info', onSessionContext);
      }

      // on all events, update event_stream
      this.subscribeAll(addEvent);
    },

    addEvent: addEvent,
    getCurrent: getCurrent,
    getCurrentEventStream: getCurrentEventStream,
    publishStored: publishStored

    // BEGIN TEST API
    ,
    setNameTable: function(table) {
      this.mediatorToKPINameTable = table;
    }
    // END TEST API
  });

  sc = Module.sc;

  return Module;

}());
