/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  var chan = Channel.build({
    window: window.parent,
    origin: "*",
    scope: "mozid_ni"
  });

  var remoteOrigin = undefined;

  function setRemoteOrigin(o) {
    if (!remoteOrigin) {
      remoteOrigin = o;
      BrowserID.User.setOrigin(remoteOrigin);
    }
  }

  chan.bind("getPersistentAssertion", function(trans, params) {
    setRemoteOrigin(trans.origin);

    trans.delayReturn(true);

    BrowserID.User.getPersistentSigninAssertion(function(rv) {
      trans.complete(rv);
    }, function() {
      trans.error();
    });
  });

  chan.bind("logout", function(trans, params) {
    setRemoteOrigin(trans.origin);

    trans.delayReturn(true);

    BrowserID.User.clearPersistentSignin(function(rv) {
      trans.complete(rv);
    }, function() {
      trans.error();
    });
  });
}());

