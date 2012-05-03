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

(function() {
  var bid = BrowserID,
      mediator = bid.Mediator,
      storage = bid.Storage.interactionData,
      network = bid.Network;

  var startTime = new Date();

  // sample rate is specified from the server.  it's set at the
  // first 'context_info' event, which corresponds to the first time
  // we get 'session_context' from the server.  When sampleRate is
  // not undefined, then the interaction data is initialized.
  // sample will be true or false
  var sample = undefined;

  var currentData = {
    event_stream: [
    ]
  };

  // whenever session_context is hit, let's hear about it so we can
  // extract the information that's important to us (like, whether we
  // should be running or not)
  mediator.subscribe('context_info', onSessionContext);

  function onSessionContext(msg, result) {
    // defend against onSessionContext being called multiple times
    if (sample !== undefined) return;

    // set the sample rate as defined by the server.  It's a value
    // between 0..1, integer or float, and it specifies the percentage
    // of the time that we should capture
    var sampleRate = result.data_sample_rate || 0;

    currentData.sample_rate = sampleRate;

    // now that we've got sample rate, let's smash it into a boolean
    // probalistically
    sample = (Math.random() <= sampleRate);

    // if we're not going to sample, kick out early.
    if (!sample) {
      currentData = undefined;
      return;
    }

    // set current time
    currentData.timestamp = result.server_time;

    // language
    currentData.lang = $('html').attr('lang');

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
    setTimeout(publishOld, 10);
  }

  // At every load, after session_context returns, we'll try to publish
  // past interaction data to the server if it exists.  The psuedo
  // transactional model employed here is to attempt to post, and only
  // once we receive a server response do we purge data.  We don't
  // care if the post is a success or failure as this data is not
  // critical to the functioning of the system (and some failure scenarios
  // simply won't resolve with retries - like corrupt data, or too much
  // data)
  function publishOld() {
    var data = storage.get();
    if (data.length === 0) return;
    network.sendInteractionData(data, complete, complete);
    return;

    function complete() {
      storage.clear();
    }
  }

  // on all events, update event_stream
  mediator.subscribeAll(function(msg, data) {
    if (sample === false) return;

    if (currentData) {
      currentData.event_stream.push([ msg, new Date() - startTime ]);
    } else {
      var d = storage.current();
      if (!d.event_stream) d.event_stream = [];
      d.event_stream.push([ msg, new Date() - startTime ]);
      storage.setCurrent(d);
    }
  });
}());
