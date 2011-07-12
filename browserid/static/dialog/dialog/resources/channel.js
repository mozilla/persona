
function errorOut(trans, code) {
  function getVerboseMessage(code) {
    var msgs = {
      "canceled": "user canceled selection",
      "notImplemented": "the user tried to invoke behavior that's not yet implemented",
      "serverError": "a technical problem was encountered while trying to communicate with BrowserID servers."
    };
    var msg = msgs[code];
    if (!msg) {
      alert("need verbose message for " + code);
      msg = "unknown error"
        }
    return msg;
  }
  trans.error(code, getVerboseMessage(code));
  window.self.close();
}

var setupChannel = function(controller) {
  var chan = Channel.build(
    {
      window: window.opener,
      origin: "*",
      scope: "mozid"
    });

  var remoteOrigin = undefined;

  chan.bind("getVerifiedEmail", function(trans, s) {
    trans.delayReturn(true);

    var remoteOrigin = trans.origin.replace(/^.*:\/\//, "");

    function onsuccess(rv) {
      trans.complete(rv);
    }

    function onerror(error) {
      errorOut(trans, error);
    }

    controller.getVerifiedEmail(remoteOrigin, onsuccess, onerror);
  });

  return chan;
};