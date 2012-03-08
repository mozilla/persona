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

  // one of two events will cause us to begin checking to
  // see if an event shall be emitted - either an explicit
  // loggedInUser event or page load.
  chan.bind("loggedInUser", function(trans, email) {
    loggedInUser = email;
  });

  chan.bind("loaded", function(trans, params) {
    setRemoteOrigin(trans.origin);

    user.getSilentAssertion(loggedInUser, function(email, assertion) {
      if (email && assertion) chan.notify({ method: 'login', params: assertion });
      else chan.notify({ method: 'logout' });
    }, function(err) {
      chan.notify({ method: 'logout' });
    });

    trans.complete();
  });

  chan.bind("logout", function(trans, params) {
    setRemoteOrigin(trans.origin);
    storage.setLoggedIn(remoteOrigin, false);
    trans.complete();
  });
}());
