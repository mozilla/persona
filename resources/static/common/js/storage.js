/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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

  var ONE_DAY_IN_MS = (1000 * 60 * 60 * 24),
      IDP_INFO_LIFESPAN_MS = 1000 * 60 * 60,
      storage = BrowserID.getStorage(),
      win = window;

  // Set default values immediately so that IE8 localStorage synchronization
  // issues do not become a factor. See issue #2206
  setDefaultValues();

  function emailsStorageKey(issuer) {
    return issuer || "default";
  }

  function storeEmails(emails, issuer) {
    // all emails are stored under the emails namespace. Each issuer has its
    // own subspace, allowing there to be multiple forced issuers. The default
    // namespace is "default"
    var allEmails;
    try {
      allEmails = JSON.parse(storage.emails || "{}");
    } catch(e) {
      clear();
      allEmails = {};
    }

    allEmails[emailsStorageKey(issuer)] = emails;
    storage.emails = JSON.stringify(allEmails);
  }

  function clear() {
    storage.removeItem("emails");
    storage.removeItem("siteInfo");
    storage.removeItem("managePage");
    // Ensure there are default values after they are removed.  This is
    // necessary so that IE8's localStorage synchronization issues do not
    // surface.  In IE8, if the dialog page is open when the verification page
    // loads and emails does not have a default value, the dialog cannot read
    // or write to localStorage. The dialog See issues #1637 and #2206
    setDefaultValues();
  }

  // initialize all localStorage values to default if they are unset.
  // this function is only neccesary on IE8 where there are localStorage
  // synchronization issues between different browsing contexts, however
  // it's intended to avoid IE8 specific bugs from being introduced.
  // see issue #1637
  function setDefaultValues() {
    _.each({
      emailToUserID: {},
      emails: {},
      interaction_data: {},
      managePage: {},
      returnTo: null,
      siteInfo: {},
      usersComputer: {}
    }, function(defaultVal, key) {
      if (!storage[key]) {
        storage[key] = JSON.stringify(defaultVal);
      }
    });
  }

  function getEmails(issuer) {
    try {
      var allEmails = JSON.parse(storage.emails || "{}");
      if (allEmails)
        return allEmails[emailsStorageKey(issuer)] || {};
    } catch(e) {
    }

    // if we had a problem parsing or the emails are null
    clear();
    return {};
  }

  function getEmailCount(issuer) {
    return _.size(getEmails(issuer));
  }

  function getEmail(email, issuer) {
    var ids = getEmails(issuer);

    return ids && ids[email];
  }

  function addEmail(email, obj, issuer) {
    var emails = getEmails(issuer);
    obj = obj || {};
    emails[email] = obj;
    storeEmails(emails, issuer);
  }

  function removeEmail(email, issuer) {
    var emails = getEmails(issuer);
    if(emails[email]) {
      delete emails[email];
      storeEmails(emails, issuer);

      // remove any sites associated with this email address.
      var siteInfo = JSON.parse(storage.siteInfo || "{}");
      for(var site in siteInfo) {
        if(siteInfo[site].email === email) {
          delete siteInfo[site].email;
        }

        if (siteInfo[site].logged_in === email) {
          delete siteInfo[site].logged_in;
        }
      }
      storage.siteInfo = JSON.stringify(siteInfo);
    }
    else {
      throw new Error("unknown email address");
    }
  }

  function invalidateEmail(email, issuer) {
    var id = getEmail(email, issuer);
    if (id) {
      delete id.priv;
      delete id.pub;
      delete id.cert;
      addEmail(email, id, issuer);
    }
    else {
      throw new Error("unknown email address");
    }
  }

  function storageCheckSet() {
    storage.storageCheck = "true";
  }

  function storageCheckGet() {
    return storage.storageCheck;
  }

  function setReturnTo(returnToURL) {
    storage.returnTo = JSON.stringify({
      at: new Date().toString(),
      url: returnToURL
    });
  }

  function getReturnTo() {
    var returnToURL;

    try {
        var staged = JSON.parse(storage.returnTo);

        if (staged) {
          if ((new Date() - new Date(staged.at)) > (2 * 60 * 60 * 1000)) throw new Error("stale");
          if (typeof(staged.url) !== 'string') throw new Error("malformed");
          returnToURL = staged.url;
        }
    } catch (x) {
      storage.removeItem("returnTo");
    }

    return returnToURL;
  }

  function siteSet(site, key, value) {
    var allSiteInfo = JSON.parse(storage.siteInfo || "{}");
    var siteInfo = allSiteInfo[site] = allSiteInfo[site] || {};

    if(key === "email" && !getEmail(value)) {
      throw new Error("unknown email address");
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

      // If no more info for site, get rid of it.
      if (!_.size(siteInfo)) delete allSiteInfo[site];

      storage.siteInfo = JSON.stringify(allSiteInfo);
    }
  }

  function siteCount(callback) {
    var allSiteInfo = JSON.parse(storage.siteInfo || "{}");
    return _.size(allSiteInfo);
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

  function loggedInCount() {
    var count = 0;
    var allSiteInfo = JSON.parse(storage.siteInfo || "{}");
    for (var key in allSiteInfo) {
      if (allSiteInfo[key].logged_in) count++;
    }

    return count;
  }

  function watchLoggedIn(origin, callback) {
    var lastState = siteGet(origin, "logged_in");

    function checkState() {
      var currentState = siteGet(origin, "logged_in");
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
    var allSiteInfo = JSON.parse(storage.siteInfo || "{}");
    for (var site in allSiteInfo) {
      delete allSiteInfo[site].logged_in;
    }
    storage.siteInfo = JSON.stringify(allSiteInfo);
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

    if (typeof userid !== 'number') throw new Error('bad userid ' + userid);

    if (!validState(state)) throw new Error("invalid state");

    var allInfo;
    var currentState;
    var lastUpdated = 0;

    try {
      allInfo = JSON.parse(storage.usersComputer);
      if (typeof allInfo !== 'object') throw new Error('bogus');

      var userInfo = allInfo[userid];
      if (userInfo) {
        currentState = userInfo.state;
        lastUpdated = Date.parse(userInfo.updated);

        if (!validState(currentState)) throw new Error("corrupt/outdated");
        if (isNaN(lastUpdated)) throw new Error("corrupt/outdated");
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
        if (typeof allInfo !== 'object') throw new Error('bogus');

        var userInfo = allInfo[userid] || {};
        userInfo.state = 'ask';
        storage.usersComputer = JSON.stringify(allInfo);
      } catch(e) {}
  }

  function clearUsersComputerOwnershipStatus(userid) {
    try {
      var allInfo = JSON.parse(storage.usersComputer);
      if (typeof allInfo !== 'object') throw new Error('bogus');

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
      if (typeof allInfo !== 'object' || allInfo === null) throw new Error("bogus");
    } catch(e) {
      allInfo = {};
    }
    _.each(emails, function(email) {
      allInfo[email] = userid;
    });
    storage.emailToUserID = JSON.stringify(allInfo);
  }

  function getIdpVerificationNonce() {
    var nonce = sessionStorage.idpNonce || win.name;
    var und;
    // the dialog window name, when opened by the shim, is __persona_dialog.
    // Ignore it, it's not a nonce.
    if (nonce === "__persona_dialog") nonce = und;

    return nonce;
  }


  function getIdpVerificationInfo(nonce) {
    // set in dialog/modules/verify_with_primary.js if the user must
    // verify with their primary.
    nonce = nonce || getIdpVerificationNonce();

    if (!nonce) return;

    var storageKey = 'idpVerification' + nonce;
    var data = storage[storageKey];

    var primaryParams;
    if (data)
      try {
        primaryParams = JSON.parse(data);
      } catch(e) {
        // invalid JSON, delete it
        storage.removeItem(storageKey);
        throw e;
      }

    return primaryParams;
  }

  function setIdpVerifcationInfo(nonce, info) {
    // FirefoxOS has a bug where sessionStorage can be purged while the user
    // is visiting their Idp. localStorage is safe. Instead of saving data
    // to sessionStorage, which may go away, we have to save to localStorage
    // in a way that avoids multi-window collisions. Create a per-window nonce.
    // Save the nonce in a cross-browser compatible way (not as easy as it
    // seems). Save the idpVerification info into localStorage using
    // the nonce as a namespace. When the user returns from the Idp, look up
    // the nonce and fetch the appropriate info.

    if (!info) {
      info = nonce;
      nonce = String(Math.random());
    }

    // The nonce is a bit tricky. Since sessionStorage is not reliable in
    // FirefoxOS, we need an alternate method. window.name survives across page
    // redirects in FirefoxOS, but not in IE8. In IE8, when the user redirects
    // to their primary, window.name is reset to "__persona_dialog". In IE8,
    // sessionStorage survives redirects to the Idp. So, we save to both.
    win.name = win.sessionStorage.idpNonce = nonce;

    // save the date to allow expired info to be purged.
    if (!info.created)
      info.created = new Date().toString();

    storage['idpVerification' + nonce] = JSON.stringify(info);
  }

  function clearIdpVerificationInfo() {
    var nonce = getIdpVerificationNonce();

    if (nonce) {
      var storageKey = 'idpVerification' + nonce;
      storage.removeItem(storageKey);
    }

    // clear any expired info
    for (var i = 0; i < localStorage.length; ++i) {
      var key = localStorage.key(i);
      if (/^idpVerification/.test(key)) {
        var info;
        try {
          info = JSON.parse(storage.getItem(key));
        }
        catch(e) {
          storage.removeItem(key);
          continue;
        }

        if (!(info && info.created)) {
          storage.removeItem(key);
          continue;
        }

        var createdTime = new Date(info.created).getTime();
        var earliestValidTime = new Date().getTime() - IDP_INFO_LIFESPAN_MS;

        if (createdTime < earliestValidTime)
          storage.removeItem(key);
      }
    }
  }

  function setRpRequestInfo(info) {
    /**
     * sessionStorage is used instead of localStorage to enable
     * multiple tabs to Persona to be open at once
     */
    if (!info.origin)
      throw new Error("missing origin");

    if (!(info.params && info.params.returnTo))
      throw new Error("missing params.returnTo");

    sessionStorage.rpRequest = JSON.stringify(info);
  }

  function getRpRequestInfo() {
    if (sessionStorage.rpRequest) {
      var data = JSON.parse(sessionStorage.rpRequest);

      try {
        if (!data.origin)
          throw new Error("rpRequest missing origin");

        if (!(data.params && data.params.returnTo))
          throw new Error("rpRequest missing params.returnTo");
      } catch(e) {
        clearRpRequestInfo();
        throw e;
      }

      return data;
    }
  }

  function clearRpRequestInfo() {
    sessionStorage.removeItem('rpRequest');
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
     * Get the number of stored emails
     * @method getEmailCount
     * @param {string} [issuer]
     * @return {number}
     */
    getEmailCount: getEmailCount,

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

    /**
     * The storageCheck namespace is where simple interaction is
     * that allows us to feature check if communication iframe is
     * able to read values set by dialog.
     */
    storageCheck: {
      /** write a test value to local storage, to be invoked from
       *  dialog */
      set: storageCheckSet,
      /** read test value to determine if local storage is sandboxed,
       *  to be invoked from communication iframe */
      get: storageCheckGet
    },

    /**
     * The site namespace is where to store any information that relates to
     * a particular RP, like which email is selected, if an email is signed in,
     * etc.
     */
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
      remove: siteRemove,

      /**
       * Get the number of sites that have info
       * @method site.count
       * @return {number}
       */
      count: siteCount
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

    /**
     * Get the number of sites the user is logged in to.
     * @method loggedInCount
     * @return {number}
     */
    loggedInCount: loggedInCount,

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
    setReturnTo: setReturnTo,
    getReturnTo: getReturnTo,
    /**
     * Set all used storage values to default if they are unset.  This function
     * is required for proper localStorage sync between different browsing contexts,
     * see issue #1637 for full details.
     * @method setDefaultValues
     */
    setDefaultValues: setDefaultValues,

    /**
     * Info used after verifying ownership of an address with an Idp.
     */
    idpVerification: {
      /**
       * Get post-Idp verification info for this window
       * @throws JSON.parse error if invalid JSON.
       */
      get: getIdpVerificationInfo,
      /**
       * Set post-Idp verification info for this window
       */
      set: setIdpVerifcationInfo,
      /**
       * Clear post-Idp verification info for this window as well as expired
       * data
       */
      clear: clearIdpVerificationInfo,
      INFO_LIFESPAN_MS: IDP_INFO_LIFESPAN_MS
    },

    /**
     * Info used for environments where the RP must redirect to Persona instead
     * of using a popup
     */
    rpRequest: {
      /**
       * Get the RP Redirection info
       * @throws JSON.parse error if invalid JSON.
       */
      get: getRpRequestInfo,
      /**
       * Set the RP Redirection info
       */
      set: setRpRequestInfo,
      /**
       * Clear any RP Redirection info
       */
      clear: clearRpRequestInfo
    }
  };
}());
