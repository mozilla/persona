/*globals BrowserID: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.Models.InteractionData = (function() {
  "use strict";

  var bid = BrowserID,
      storage = bid.getStorage(),
      network = bid.Network,
      complete = bid.Helpers.complete,
      whitelistFilter = bid.Helpers.whitelistFilter,
      KPI_WHITELIST = [
        'event_stream',
        'lang',
        'screen_size',
        'sample_rate',
        'timestamp',
        'number_emails',
        'sites_signed_in',
        'sites_visited',
        'orphaned',
        'new_account',
        'email_type'
      ];


  function getInteractionData() {
    var interactionData;
    try {
      interactionData = JSON.parse(storage.interaction_data);
    } catch(e) {
    }

    return interactionData || {};
  }

  function setInteractionData(data) {
    try {
      storage.interaction_data = JSON.stringify(data);
    } catch(e) {
      storage.removeItem("interaction_data");
    }
  }

  function push(newData) {
    stageCurrent();

    var interactionData = getInteractionData();
    interactionData.current = newData;

    setInteractionData(interactionData);
  }

  function getCurrent() {
    var interactionData = getInteractionData();

    return interactionData.current;
  }

  function setCurrent(data) {
    var interactionData = getInteractionData();
    interactionData.current = data;
    setInteractionData(interactionData);
  }

  function stageCurrent() {
    // Push existing current data to the staged list.  This allows
    // us to get/clear the staged list without affecting the current data.
    var interactionData = getInteractionData();

    if (interactionData.current) {
      var staged = interactionData.staged = interactionData.staged || [];
      staged.unshift(interactionData.current);

      delete interactionData.current;

      setInteractionData(interactionData);
    }
  }

  function getStaged() {
    var interactionData = getInteractionData();
    return interactionData.staged || [];
  }

  function clearStaged() {
    var interactionData = getInteractionData();
    delete interactionData.staged;
    setInteractionData(interactionData);
  }

  // We'll try to publish past interaction data to the server if it exists.
  // The psuedo transactional model employed here is to attempt to post, and
  // only once we receive a server response do we purge data.  We don't
  // care if the post is a success or failure as this data is not
  // critical to the functioning of the system (and some failure scenarios
  // simply won't resolve with retries - like corrupt data, or too much
  // data)
  function publishStaged(oncomplete) {
     var data = getStaged();

    // XXX: should we even try to post data if it's larger than some reasonable
    // threshold?
    if (data && data.length !== 0) {

      // Scrub the data we are going to send and let only a set of whitelisted
      // keys through.  This will remove such values as local_timestamp, which
      // we needed to calculate time offsets in our event stream, but which
      // could be used to fingerprint users.
      var filtered = [];
      _.each(data, function(obj) {
        filtered.push(whitelistFilter(obj, KPI_WHITELIST));
      });

      network.sendInteractionData(filtered, function() {
        clearStaged();
        complete(oncomplete, true);
      }, function(status) {
        // if the server returns a 413 error, (too much data posted), then
        // let's clear our local storage and move on.  This does mean we
        // loose some interaction data, but it shouldn't be statistically
        // significant.
        if (status && status.network && status.network.status === 413) {
          clearStaged();
        }
        complete(oncomplete, false);
      });
    }
    else {
      complete(oncomplete, false);
    }
  }

  return {
    /**
     * add a new interaction blob to localstorage, this will *push* any stored
     * blobs to the 'staged' backlog, and happens when a new dialog interaction
     * begins.
     * @method push
     * @param {object} data - an object to push onto the queue
     * @returns nada
     */
    push: push,
    /**
     * read the interaction data blob associated with the current interaction
     * @method getCurrent
     * @returns a JSON object containing the latest interaction data blob
     */
    getCurrent: getCurrent,
    /**
     * overwrite the interaction data blob associated with the current interaction
     * @method setCurrent
     * @param {object} data - the object to overwrite current with
     */
    setCurrent: setCurrent,
    /**
     * Shift any "current" data into the staged list.  No data will be listed
     * as current afterwards.
     * @method stageCurrent
     */
    stageCurrent: stageCurrent,
    /**
     * get all past saved interaction data (returned as a JSON array), excluding
     * the "current" data (that which is being collected now).
     * @method getStaged
     * @returns an array, possibly of length zero if no past interaction data is
     * available
     */
    getStaged: getStaged,
    /**
     * publish staged data. Staged data will be cleared if successfully posted
     * to server or if server returns 413 - too much data.
     * @param {function} [oncomplete] - function to call when complete.  Called
     * with true if data was successfully sent to server, false otw.
     * @method publishStaged
     */
    publishStaged: publishStaged,
    /**
     * clear all interaction data, except the current, in-progress
     * collection.
     * @method clearStaged()
     */
    clearStaged: clearStaged
  };

}());
