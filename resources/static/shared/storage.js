/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*globals BrowserID: true, console: true */
BrowserID.getStorage = function() {
  var storage;

  try {
    storage = localStorage;
  }
  catch(e) {
    // Fx with cookies disabled will except while trying to access
    // localStorage.  IE6/IE7 will just plain blow up because they have no
    // notion of localStorage.  Because of this, and because the new API
    // requires access to localStorage, create a fake one with removeItem.
    storage = {
      removeItem: function(key) {
        this[key] = null;
        delete this[key];
      }
    };
  }

  return storage;
};

BrowserID.Storage = (function() {
  "use strict";

  var jwcrypto,
      ONE_DAY_IN_MS = (1000 * 60 * 60 * 24),
      storage = BrowserID.getStorage();

  // temporary, replace with helpers.log if storage uses elog long term...
  function elog (msg) {
    if (window.console && console.error) console.error(msg);
  }

  function prepareDeps() {
    if (!jwcrypto) {
      jwcrypto = require("./jwcrypto");
    }
  }

  function storeEmails(emails) {
    storage.emails = JSON.stringify(emails);
  }

  function clear() {
    storage.removeItem("emails");
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

  function addPrimaryEmail(email, obj) {
    obj = obj || {};
    obj.type = "primary";
    addEmail(email, obj);
  }

  function addSecondaryEmail(email, obj) {
    obj = obj || {};
    obj.type = "secondary";
    addEmail(email, obj);
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

      var kp = {};
      kp.publicKey = jwcrypto.loadPublicKeyFromObject(raw_kp.publicKey);
      kp.secretKey = jwcrypto.loadSecretKeyFromObject(raw_kp.secretKey);
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

  function generic2KeySet(namespace, key, value) {
    var allInfo = JSON.parse(storage[namespace] || "{}");
    allInfo[key] = value;
    storage[namespace] = JSON.stringify(allInfo);
  }

  function generic2KeyGet(namespace, key) {
    var allInfo = JSON.parse(storage[namespace] || "{}");
    return allInfo[key];
  }

  function generic2KeyRemove(namespace, key) {
    var allInfo = JSON.parse(storage[namespace] || "{}");
    delete allInfo[key];
    storage[namespace] = JSON.stringify(allInfo);
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
      }
    }

    // IE8 does not have addEventListener, nor does it support storage events.
    if (window.addEventListener) window.addEventListener('storage', checkState, false);
    else window.setInterval(checkState, 2000);
  }
  function logoutEverywhere() {
    storage.loggedIn = "{}";
  }

  function mapEmailToUserID(emailOrUserID) {
    if (typeof(emailOrUserID) === 'number') return emailOrUserID;
    var allInfo = JSON.parse(storage.emailToUserID || "{}");
    return allInfo[emailOrUserID];
  }

  // tools to manage knowledge of whether this is the user's computer,
  // which helps us set appropriate authentication duration.
  function validState(state) {
    return (state === 'seen' || state === 'confirmed' || state === 'denied');
  }

  function setConfirmationState(userid, state) {
    userid = mapEmailToUserID(userid);

    if (typeof userid !== 'number') throw 'bad userid ' + userid;

    if (!validState(state)) throw "invalid state";

    var allInfo;
    var currentState;
    var lastUpdated = 0;

    try {
      allInfo = JSON.parse(storage.usersComputer);
      if (typeof allInfo !== 'object') throw 'bogus';

      var userInfo = allInfo[userid];
      if (userInfo) {
        currentState = userInfo.state;
        lastUpdated = Date.parse(userInfo.updated);

        if (!validState(currentState)) throw "corrupt/outdated";
        if (isNaN(lastUpdated)) throw "corrupt/outdated";
      }
    } catch(e) {
      currentState = undefined;
      lastUpdated = 0;
      allInfo = {};
    }

    // ...now determine if we should update the state...

    // first if the user said this wasn't their computer over 24 hours ago,
    // forget that setting (we will revisit this)
    if (currentState === 'denied' &&
        ((new Date()).getTime() - lastUpdated) > ONE_DAY_IN_MS) {
      currentState = undefined;
      lastUpdated = 0;
    }

    // if the user has a non-null state and this is another user sighting
    // (seen), then forget it
    if (state === 'seen' && currentState) return;

    // good to go!  let's make the update
    allInfo[userid] = {state: state, updated: new Date().toString()};
    storage.usersComputer = JSON.stringify(allInfo);
  }

  function userConfirmedOnComputer(userid) {
    try {
      userid = mapEmailToUserID(userid);
      var allInfo = JSON.parse(storage.usersComputer || "{}");
      return allInfo[userid].state === 'confirmed';
    } catch(e) {
      return false;
    }
  }

  function shouldAskUserAboutHerComputer(userid) {
    // if any higher level code passes in a non-userid,
    // we'll tell them not to ask, triggering ephemeral sessions.
    if (typeof userid !== 'number') return false;

    // we should ask the user if this is their computer if they were
    // first seen over a minute ago, if they haven't denied ownership
    // of this computer in the last 24 hours, and they haven't confirmed
    // ownership of this computer
    try {
      userid = mapEmailToUserID(userid);
      var allInfo = JSON.parse(storage.usersComputer);
      var userInfo = allInfo[userid];
      if(userInfo) {
        var s = userInfo.state;
        var timeago = new Date() - Date.parse(userInfo.updated);

        // The ask state is an artificial state that should never be seen in
        // the wild.  It is used in testing.
        if (s === 'ask') return true;
        if (s === 'confirmed') return false;
        if (s === 'denied' && timeago > ONE_DAY_IN_MS) return true;
        if (s === 'seen' && timeago > (60 * 1000)) return true;
      }
    } catch (e) {
      return true;
    }

    return false;
  }

  function setUserSeenOnComputer(userid) {
    setConfirmationState(userid, 'seen');
  }

  function setUserConfirmedOnComputer(userid) {
    setConfirmationState(userid, 'confirmed');
  }

  function setNotMyComputer(userid) {
    setConfirmationState(userid, 'denied');
  }

  function setUserMustConfirmComputer(userid) {
      try {
        userid = mapEmailToUserID(userid);
        var allInfo = JSON.parse(storage.usersComputer);
        if (typeof allInfo !== 'object') throw 'bogus';

        var userInfo = allInfo[userid] || {};
        userInfo.state = 'ask';
        storage.usersComputer = JSON.stringify(allInfo);
      } catch(e) {}
  }

  function clearUsersComputerOwnershipStatus(userid) {
    try {
      var allInfo = JSON.parse(storage.usersComputer);
      if (typeof allInfo !== 'object') throw 'bogus';

      var userInfo = allInfo[userid];
      if (userInfo) {
        allInfo[userid] = null;
        delete allInfo[userid];
        storage.usersComputer = JSON.stringify(allInfo);
      }
    } catch (e) {}
  }

  // update our local storage based mapping of email addresses to userids,
  // this map helps us determine whether a specific email address belongs
  // to a user who has already confirmed their ownership of a computer.
  function updateEmailToUserIDMapping(userid, emails) {
    var allInfo;
    try {
      allInfo = JSON.parse(storage.emailToUserID);
      if (typeof allInfo != 'object' || allInfo === null) throw "bogus";
    } catch(e) {
      allInfo = {};
    }
    _.each(emails, function(email) {
      allInfo[email] = userid;
    });
    storage.emailToUserID = JSON.stringify(allInfo);
  }

  return {
    /**
     * Add an email address and optional key pair.
     * @method addEmail
     */
    addEmail: addEmail,
    /**
     * Add a primary address
     * @method addPrimaryEmail
     */
    addPrimaryEmail: addPrimaryEmail,
    /**
     * Add a secondary address
     * @method addSecondaryEmail
     */
    addSecondaryEmail: addSecondaryEmail,
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
      set: generic2KeySet.curry("managePage"),
      get: generic2KeyGet.curry("managePage"),
      remove: generic2KeyRemove.curry("managePage")
    },

    signInEmail: {
      set: generic2KeySet.curry("main_site", "signInEmail"),
      get: generic2KeyGet.curry("main_site", "signInEmail"),
      remove: generic2KeyRemove.curry("main_site", "signInEmail")
    },

    usersComputer: {
      /**
       * Query whether the user has confirmed that this is their computer
       * @param {integer} userid - the user's numeric id, returned from session_context when authed.
       * @method usersComputer.confirmed */
      confirmed: userConfirmedOnComputer,
      /**
       * Save the fact that a user confirmed that this is their computer
       * @param {integer} userid - the user's numeric id, returned from session_context when authed.
       * @method usersComputer.setConfirmed */
      setConfirmed: setUserConfirmedOnComputer,
      /**
       * Save the fact that a user denied that this is their computer
       * @param {integer} userid - the user's numeric id, returned from session_context when authed.
       * @method usersComputer.setDenied */
      setDenied: setNotMyComputer,
      /**
       * Should we ask the user if this is their computer, based on the last
       * time they used browserid and the last time they answered a question
       * about this device
       * @param {integer} userid - the user's numeric id, returned
       *   from session_context when authed.
       * @method usersComputer.seen */
      shouldAsk: shouldAskUserAboutHerComputer,
      /**
       * Save the fact that a user has been seen on this computer before, but do not overwrite
       *  existing state
       * @param {integer} userid - the user's numeric id, returned from session_context when authed.
       * @method usersComputer.setSeen */
      setSeen: setUserSeenOnComputer,
      /**
       * Clear the status for the user
       * @param {integer} userid - the user's numeric id, returned from session_context when authed.
       * @method usersComputer.clear */
      clear: clearUsersComputerOwnershipStatus,
      /**
       * Force the user to be asked their status
       * @param {integer} userid - the user's numeric id, returned from session_context when authed.
       * @method usersComputer.forceAsk */
      forceAsk: setUserMustConfirmComputer
    },

    /** add email addresses to the email addy to userid mapping used when we're trying to determine
     * if a user has used this computer before and what their auth duration should be
     * @param {number} userid - the userid of the user
     * @param {array} emails - a list of email addresses belonging to the user
     * @returns zilch
     */
    updateEmailToUserIDMapping: updateEmailToUserIDMapping,

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
