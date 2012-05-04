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
      storage = bid.Storage.interactionData,
      network = bid.Network,
      complete = bid.Helpers.complete,
      dom = bid.DOM,
      sc;

  function onSessionContext(msg, result) {
    var self=this;

    // defend against onSessionContext being called multiple times
    if (self.sessionContextHandled) return;
    self.sessionContextHandled = true;

    // Publish any outstanding data.  Unless this is a continuation, previous
    // session data must be published independently of whether the current
    // dialog session is allowed to sample data. This is because the original
    // dialog session has already decided whether to collect data.
    publishStored();

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
    storage.push(currentData);

    self.initialEventStream = null;

    self.samplesBeingStored = true;
  }

  // At every load, after session_context returns, we'll try to publish
  // past interaction data to the server if it exists.  The psuedo
  // transactional model employed here is to attempt to post, and only
  // once we receive a server response do we purge data.  We don't
  // care if the post is a success or failure as this data is not
  // critical to the functioning of the system (and some failure scenarios
  // simply won't resolve with retries - like corrupt data, or too much
  // data)
  function publishStored(oncomplete) {
    var data = storage.get();

    if (data && data.length !== 0) {
      network.sendInteractionData(data, function() {
        storage.clear();
        complete(oncomplete, true);
      });
    }
    else {
      complete(oncomplete, false);
    }
  }


  function addEvent(eventName) {
    var self=this;

    if (self.samplingEnabled === false) return;

    var eventData = [ eventName, new Date() - self.startTime ];
    if (self.samplesBeingStored) {
      var d = storage.current() || {};
      if (!d.event_stream) d.event_stream = [];
      d.event_stream.push(eventData);
      storage.setCurrent(d);
    } else {
      self.initialEventStream.push(eventData);
    }
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      options = options || {};

      var self = this;

      // options.samplingEnabled is used for testing purposes.
      //
      // If samplingEnabled is not specified in the options, and this is not
      // a continuation, samplingEnabled will be decided on the first "
      // context_info" event, which corresponds to the first time
      // 'session_context' returns from the server.
      self.samplingEnabled = options.samplingEnabled;

      // continuation means the users dialog session is continuing, probably
      // due to a redirect to an IdP and then a return after authentication.
      if (options.continuation) {
        var previousData = storage.current();

        var samplingEnabled = self.samplingEnabled = !!previousData.event_stream;
        if (samplingEnabled) {
          self.startTime = Date.parse(previousData.local_timestamp);

          if (typeof self.samplingEnabled === "undefined") {
            self.samplingEnabled = samplingEnabled;
          }

          // instead of waiting for session_context to start appending data to
          // localStorage, start saving into localStorage now.
          self.samplesBeingStored = true;
        }
        else {
          // If there was no previous event stream, that means data collection
          // was not allowed for the previous session.  Return with no further
          // action, data collection is not allowed for this session either.
          return;
        }
      }
      else {
        self.startTime = new Date();

        // The initialEventStream is used to store events until onSessionContext
        // is called.  Once onSessionContext is called and it is known whether
        // the user's data will be saved, initialEventStream will either be
        // discarded or added to the data set that is saved to localStorage.
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

    getCurrentStoredData: function() {
      var und;
      return this.samplesBeingStored ? storage.current() : und;
    },

    getEventStream: function() {
      return this.samplesBeingStored ? storage.current().event_stream : this.initialEventStream || [];
    },

    publishStored: publishStored
  });

  sc = Module.sc;

  return Module;

}());
