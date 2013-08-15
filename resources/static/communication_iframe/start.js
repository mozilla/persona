/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  var bid = BrowserID,
      network = bid.Network,
      user = bid.User,
      storage = bid.Storage,
      interactionData = bid.Models.InteractionData;

  // Initialize all localstorage values to default values.  Neccesary for
  // proper sync of IE8 localStorage across multiple simultaneous
  // browser sessions.
  storage.setDefaultValues();

  network.init();
  user.init();

  var chan = Channel.build({
    window: window.parent,
    origin: "*",
    scope: "mozid_ni"
  });

  var remoteOrigin;

  function setRemoteOrigin(o) {
    if (!remoteOrigin) {
      remoteOrigin = o;
      user.setOrigin(remoteOrigin);
      var issuer = storage.site.get(o, "issuer");
      user.setIssuer(issuer || "default");
    }
  }

  var loggedInUser;

  // the controlling page may "pause" the iframe when someone else (the dialog)
  // is supposed to emit events
  var pause = false;

  function checkAndEmit(oncomplete) {
    if (pause) return;

    function onError() {
      chan.notify({ method: 'logout' });
      loggedInUser = null;
      oncomplete && oncomplete();
    }

    // All XHR requests are aborted when the user browsers away from the RP.
    // Outstanding calls to cookiesEnabled (which calls /wsapi/session_context)
    // will be aborted, the onError callback will not be invoked. All other XHR
    // errors will call onError. See issues #2423, #3619
    network.cookiesEnabled(function(enabled) {
      if (!enabled) {
        // cookies are disabled, call onready and do nothing more.
        // By not setting loggedInUser to null, the RP can call .logout
        // a single time and have the .onlogout callback fired, which in
        // turn allows the RP to sign the user out of their site.
        return oncomplete && oncomplete();
      }

      // this will re-certify the user if neccesary
      user.getSilentAssertion(loggedInUser, function(email, assertion) {
        if (loggedInUser === email) {
          chan.notify({ method: 'match' });
        } else if (email) {
          // only send login events when the assertion is defined - when
          // the 'loggedInUser' is already logged in, it's false - that is
          // when the site already has the user logged in and does not want
          // the resources or cost required to generate an assertion
          if (assertion) chan.notify({ method: 'login', params: assertion });
          loggedInUser = email;
        } else if (loggedInUser !== null) {
          // only send logout events when loggedInUser is not null, which is an
          // indicator that the site thinks the user is logged out
          chan.notify({ method: 'logout' });
          loggedInUser = null;
        }
        oncomplete && oncomplete();
      }, onError);
    }, onError);
  }

  function watchState() {
    storage.watchLoggedIn(remoteOrigin, checkAndEmit);
  }

  // one of two events will cause us to begin checking to
  // see if an event shall be emitted - either an explicit
  // loggedInUser event or page load.
  chan.bind("loggedInUser", function(trans, email) {
    loggedInUser = email;
  });

  chan.bind("loaded", function(trans, params) {
    trans.delayReturn(true);
    setRemoteOrigin(trans.origin);
    checkAndEmit(function() {
      watchState();
      trans.complete();
    });
  });

  chan.bind("logout", function(trans, params) {
    // set remote origin so that .logout can be called even if .request has
    // not.
    // See https://github.com/mozilla/browserid/pull/2529
    setRemoteOrigin(trans.origin);
    // loggedInUser will be undefined if none of loaded, loggedInUser nor
    // logout have been called before. This allows the user to be force logged
    // out.
    if (loggedInUser !== null) {
      storage.site.remove(remoteOrigin, "logged_in");
      loggedInUser = null;
      chan.notify({ method: 'logout' });
    }
  });

  chan.bind("redirect_flow", function(trans, params) {
    setRemoteOrigin(trans.origin);
    storage.rpRequest.set({
      origin: remoteOrigin,
      params: JSON.parse(params)
    });
    return true;
  });

  chan.bind("dialog_running", function(trans, params) {
    pause = true;
  });

  chan.bind("dialog_complete", function(trans, checkAuthStatus) {
    pause = false;
    // The dialog has closed, so that we get results from users who only open
    // the dialog a single time, send the KPIs immediately. Note, this does not
    // take care of native contexts. Native contexts are taken care of in in
    // dialog/js/misc/internal_api.js. Errors sending the KPI data should not
    // affect anything else.
    try {
      var currentData = interactionData.getCurrent();
      if (currentData) {
        // set the last KPIs from the current state of the world.
        _.extend(currentData, {
          number_emails: storage.getEmailCount() || 0,
          number_sites_signed_in: storage.loggedInCount() || 0,
          number_sites_remembered: storage.site.count() || 0
        });

        interactionData.setCurrent(currentData);
        interactionData.publishCurrent();
      }
    } catch(e) {}

    if (checkAuthStatus) {
      // the dialog running can change authentication status,
      // lets manually purge our network cache
      user.clearContext();
      checkAndEmit();
    }
  });
}());
