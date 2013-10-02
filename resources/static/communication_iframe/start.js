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
      var options = {
        origin: remoteOrigin
      };

      var issuer = storage.site.get(remoteOrigin, "issuer");
      if (issuer) options.issuer = issuer;

      var rpInfo = bid.Models.RpInfo.create(options);
      user.setRpInfo(rpInfo);
    }
  }

  // the watch message is received when the RP invokes watch.  This implies that
  // the page is ready to recieve an assertion if there is one queued up for it.
  chan.bind("watch", function(trans, params) {
    console.log("watch called with", params);

    setRemoteOrigin(trans.origin);

    // we can synchronously check to see if there is an assertion pending for this domain.
    var assertion_pending = storage.site.get(remoteOrigin, "logged_in");
    console.log('assertion pending', assertion_pending);

    if (assertion_pending) {
      // asynchronous return
      trans.delayReturn(true);

      // this will re-certify the user if neccesary
      user.getSilentAssertion(null, function(email, assertion) {
        // clear single-fire bit
        storage.site.set(remoteOrigin, "logged_in", null);

        // complete with assertion if available, null otherwise
        trans.complete(assertion || null);
      }, function() {
        trans.complete(null);
      });
    } else {
      return null;
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
}());
