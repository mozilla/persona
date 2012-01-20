/*globals BrowserID: true, Channel: true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  var bid = BrowserID,
      network = bid.Network,
      user = bid.User;

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

  chan.bind("getPersistentAssertion", function(trans, params) {
    setRemoteOrigin(trans.origin);

    trans.delayReturn(true);

    user.getPersistentSigninAssertion(function(rv) {
      trans.complete(rv);
    }, function() {
      trans.error();
    });
  });

  chan.bind("logout", function(trans, params) {
    setRemoteOrigin(trans.origin);

    trans.delayReturn(true);

    user.clearPersistentSignin(function(rv) {
      trans.complete(rv);
    }, function() {
      trans.error();
    });
  });
}());

