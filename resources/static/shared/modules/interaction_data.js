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
//  * the primary flow will cause unload and reload.  omg.  How do we deal?

BrowserID.Modules.InteractionData = (function() {
  var bid = BrowserID,
      storage = bid.Storage.interactionData,
      network = bid.Network,
      dom = bid.DOM,
      sc;

  function onSessionContext(msg, result) {
    var self=this,
        currentData = self.currentData;

    // defend against onSessionContext being called multiple times
    if (self.sample !== undefined) return;

    // set the sample rate as defined by the server.  It's a value
    // between 0..1, integer or float, and it specifies the percentage
    // of the time that we should capture
    var sampleRate = result.data_sample_rate || 0;

    // now that we've got sample rate, let's smash it into a boolean
    // probalistically
    self.sample = self.forceSample || (Math.random() <= sampleRate);

    // if we're not going to sample, kick out early.
    if (!self.sample) {
      self.currentData = undefined;
      return;
    }

    currentData.sample_rate = sampleRate;

    // set current time
    currentData.timestamp = result.server_time;

    // language
    currentData.lang = dom.getAttr('html', 'lang');

    if (window.screen) {
      currentData.screen_size = {
        width: window.screen.width,
        height: window.screen.height
      };
    }

    // XXX: implement me!
    currentData.user_agent = {
      os: null,
      browser: null,
      version: null
    };

    // cool.  now let's persist this data
    storage.push(currentData);
    currentData = undefined;

    // finally, let's try to publish any old data
    setTimeout(publish, 10);
  }

  // At every load, after session_context returns, we'll try to publish
  // past interaction data to the server if it exists.  The psuedo
  // transactional model employed here is to attempt to post, and only
  // once we receive a server response do we purge data.  We don't
  // care if the post is a success or failure as this data is not
  // critical to the functioning of the system (and some failure scenarios
  // simply won't resolve with retries - like corrupt data, or too much
  // data)
  function publish() {
    var data = storage.get();

    if (data.length === 0) return;

    network.sendInteractionData(data, complete, function() {
      storage.clear();
    });
  }


  function addEvent(eventName) {
    var self=this;

    if (self.sample === false) return;

    var eventData = [ eventName, new Date() - self.startTime ];
    if (self.currentData) {
      self.currentData.event_stream.push(eventData);
    } else {
      // @lloyd, how does this bit work?  When can sampling be enabled but
      // there not be currentData?  It looks like currentData is created as
      // soon as this module is run, and cleared only when session context
      // comes in.
      var d = storage.current();
      if (!d.event_stream) d.event_stream = [];
      d.event_stream.push(eventData);
      storage.setCurrent(d);
    }
  }

  var Module = bid.Modules.PageModule.extend({
    start: function(options) {
      options = options || {};

      var self = this;

      self.forceSample = options.forceSample;

      self.startTime = new Date();

      // sample rate is specified from the server.  it's set at the
      // first 'context_info' event, which corresponds to the first time
      // we get 'session_context' from the server.  When sampleRate is
      // not undefined, then the interaction data is initialized.
      // sample will be true or false
      self.sample = undefined;

      self.currentData = {
        event_stream: [
        ]
      };

      // whenever session_context is hit, let's hear about it so we can
      // extract the information that's important to us (like, whether we
      // should be running or not)
      this.subscribe('context_info', onSessionContext);

      // on all events, update event_stream
      this.subscribeAll(addEvent);
    },

    addEvent: addEvent,

    isSampling: function() {
      return this.sample;
    },

    getData: function() {
      return this.currentData;
    },

    getStream: function() {
      return this.currentData && this.currentData.event_stream;
    },

    publish: publish
  });

  sc = Module.sc;

  return Module;

}());
