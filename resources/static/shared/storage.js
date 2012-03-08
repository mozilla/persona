/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.Storage = (function() {

  var jwk,
      storage = localStorage;

  function prepareDeps() {
    if (!jwk) {
      jwk = require("./jwk");
    }
  }

  function storeEmails(emails) {
    storage.emails = JSON.stringify(emails);
  }

  function clear() {
    storeEmails({});
    storage.removeItem("tempKeypair");
    storage.removeItem("stagedOnBehalfOf");
    storage.removeItem("siteInfo");
    storage.removeItem("managePage");
  }

  function getEmails() {
    try {
      var emails = JSON.parse(storage.emails || "{}");
      if (emails !== null)
        return emails;
    } catch(e) {
    }

    // if we had a problem parsing or the emails are null
    clear();
    return {};
  }

  function getEmail(email) {
    var ids = getEmails();

    return ids && ids[email];
  }

  function addEmail(email, obj) {
    var emails = getEmails();
    emails[email] = obj;
    storeEmails(emails);
  }

  function removeEmail(email) {
    var emails = getEmails();
    if(emails[email]) {
      delete emails[email];
      storeEmails(emails);

      // remove any sites associated with this email address.
      var siteInfo = JSON.parse(storage.siteInfo || "{}");
      for(var site in siteInfo) {
        if(siteInfo[site].email === email) {
          delete siteInfo[site].email;
        }
      }
      storage.siteInfo = JSON.stringify(siteInfo);
    }
    else {
      throw "unknown email address";
    }
  }

  function invalidateEmail(email) {
    var id = getEmail(email);
    if (id) {
      delete id.priv;
      delete id.pub;
      delete id.cert;
      addEmail(email, id);
    }
    else {
      throw "unknown email address";
    }
  }

  function storeTemporaryKeypair(keypair) {
    storage.tempKeypair = JSON.stringify({
      publicKey: keypair.publicKey.toSimpleObject(),
      secretKey: keypair.secretKey.toSimpleObject()
    });
  }

  function retrieveTemporaryKeypair() {
    var raw_kp = JSON.parse(storage.tempKeypair || "");
    storage.tempKeypair = null;
    if (raw_kp) {
      prepareDeps();
      var kp = new jwk.KeyPair();
      kp.publicKey = jwk.PublicKey.fromSimpleObject(raw_kp.publicKey);
      kp.secretKey = jwk.SecretKey.fromSimpleObject(raw_kp.secretKey);
      return kp;
    } else {
      return null;
    }
  }

  function setStagedOnBehalfOf(origin) {
    storage.stagedOnBehalfOf = JSON.stringify({
      at: new Date().toString(),
      origin: origin
    });
  }

  function getStagedOnBehalfOf() {
    var origin;

    try {
      var staged = JSON.parse(storage.stagedOnBehalfOf);

      if (staged) {
        if ((new Date() - new Date(staged.at)) > (5 * 60 * 1000)) throw "stale";
        if (typeof(staged.origin) !== 'string') throw "malformed";
        origin = staged.origin;
      }
    } catch (x) {
      storage.removeItem("stagedOnBehalfOf");
    }

    return origin;
  }

  function siteSet(site, key, value) {
    var allSiteInfo = JSON.parse(storage.siteInfo || "{}");
    var siteInfo = allSiteInfo[site] = allSiteInfo[site] || {};

    if(key === "email" && !getEmail(value)) {
      throw "unknown email address";
    }

    siteInfo[key] = value;

    storage.siteInfo = JSON.stringify(allSiteInfo);
  }

  function siteGet(site, key) {
    var allSiteInfo = JSON.parse(storage.siteInfo || "{}");
    var siteInfo = allSiteInfo[site];

    return siteInfo && siteInfo[key];
  }

  function siteRemove(site, key) {
    var allSiteInfo = JSON.parse(storage.siteInfo || "{}");
    var siteInfo = allSiteInfo[site];

    if (siteInfo) {
      delete siteInfo[key];
      storage.siteInfo = JSON.stringify(allSiteInfo);
    }
  }

  function managePageGet(key) {
    var allInfo = JSON.parse(storage.managePage || "{}");
    return allInfo[key];
  }

  function managePageSet(key, value) {
    var allInfo = JSON.parse(storage.managePage || "{}");
    allInfo[key] = value;
    storage.managePage = JSON.stringify(allInfo);
  }

  function managePageRemove(key) {
    var allInfo = JSON.parse(storage.managePage || "{}");
    delete allInfo[key];
    storage.managePage = JSON.stringify(allInfo);
  }

  function setLoggedIn(origin, email) {
    var allInfo = JSON.parse(storage.loggedIn || "{}");
    if (email) allInfo[origin] = email;
    else delete allInfo[origin];
    storage.loggedIn = JSON.stringify(allInfo);
  }
  function getLoggedIn(origin) {
    var allInfo = JSON.parse(storage.loggedIn || "{}");
    return allInfo[origin];
  }
  function watchLoggedIn(origin, callback) {
    var lastState = getLoggedIn(origin);

    function checkState() {
      var currentState = getLoggedIn(origin);
      if (lastState !== currentState) {
        callback();
        lastState = currentState;
      };
    }

    // does IE8 not have addEventListener, nor does it support storage events.
    if (window.addEventListener) window.addEventListener('storage', checkState, false);
    else window.setInterval(checkState, 2000);
  }
  function logoutEverywhere() {
    storage.loggedIn = "{}";
  }

  return {
    /**
     * Add an email address and optional key pair.
     * @method addEmail
     */
    addEmail: addEmail,
    /**
     * Get all email addresses and their associated key pairs
     * @method getEmails
     */
    getEmails: getEmails,
    /**
     * Get one email address and its key pair, if found.  Returns undefined if
     * not found.
     * @method getEmail
     */
    getEmail: getEmail,
    /**
     * Remove an email address, its key pairs, and any sites associated with
     * email address.
     * @throws "unknown email address" if email address is not known.
     * @method removeEmail
     */
    removeEmail: removeEmail,
    /**
     * Remove the key information for an email address.
     * @throws "unknown email address" if email address is not known.
     * @method invalidateEmail
     */
    invalidateEmail: invalidateEmail,

    site: {
      /**
       * Set a data field for a site
       * @method site.set
       * @param {string} site - site to set info for
       * @param {string} key - key to set
       * @param {variant} value - value to set
       */
      set: siteSet,
      /**
       * Get a data field for a site
       * @method site.get
       * @param {string} site - site to get info for
       * @param {string} key - key to get
       */
      get: siteGet,
      /**
       * Remove a data field for a site
       * @method site.remove
       * @param {string} site - site to remove info for
       * @param {string} key - key to remove
       */
      remove: siteRemove
    },

    manage_page: {
      /**
       * Set a data field for the manage page
       * @method managePage.set
       */
      set: managePageSet,
      get: managePageGet,
      remove: managePageRemove
    },

    /** set logged in state for a site
     * @param {string} origin - the site to set logged in state for
     * @param {string} email - the email that the user is logged in with or falsey if login state should be cleared
     */
    setLoggedIn: setLoggedIn,

    /** check if the user is logged into a site
     * @param {string} origin - the site to set check the logged in state of
     * @returns the email with which the user is logged in
     */
    getLoggedIn: getLoggedIn,

    /** watch for changes in the logged in state of a page
     * @param {string} origin - the site to watch the status of
     * @param {function} callback - a callback to invoke when state changes
     */
    watchLoggedIn: watchLoggedIn,

    /** clear all logged in preferences
     * @param {string} origin - the site to watch the status of
     * @param {function} callback - a callback to invoke when state changes
     */
    logoutEverywhere: logoutEverywhere,

    /**
     * Clear all stored data - email addresses, key pairs, temporary key pairs,
     * site/email associations.
     * @method clear
     */
    clear: clear,
    storeTemporaryKeypair: storeTemporaryKeypair,
    retrieveTemporaryKeypair: retrieveTemporaryKeypair,
    setStagedOnBehalfOf: setStagedOnBehalfOf,
    getStagedOnBehalfOf: getStagedOnBehalfOf
  };
}());
