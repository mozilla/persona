/*globals BrowserID: true, Channel: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  var bid = BrowserID,
      network = bid.Network,
      user = bid.User,
      storage = bid.Storage;

  network.init();

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
    }
  }

  var loggedInUser = undefined;

  function checkAndEmit() {
    user.getSilentAssertion(loggedInUser, function(email, assertion) {
      if (email) {
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
    }, function(err) {
      chan.notify({ method: 'logout' });
      loggedInUser = null;
    });
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
    setRemoteOrigin(trans.origin);
    checkAndEmit();
    watchState();
    trans.complete();
  });

  chan.bind("logout", function(trans, params) {
    setRemoteOrigin(trans.origin);
    storage.setLoggedIn(remoteOrigin, false);
    trans.complete();
  });
}());
