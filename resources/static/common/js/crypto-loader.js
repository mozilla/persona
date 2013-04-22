/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


/**
 * Takes care of loading up jwcrypto
 */

BrowserID.CryptoLoader = (function() {
  "use strict";

  var bid = BrowserID,
      mediator = bid.Mediator,
      network = bid.Network,
      RECHECK_DELAY_MS = 50;

  function addScript(src) {
    var script = document.createElement("script");
    script.setAttribute("src", src);
    var entryPoint = document.getElementsByTagName("script")[0];
    entryPoint.parentNode.insertBefore(script, entryPoint);
  }

  function waitUntilExists(checkFor, context, done) {
    if(checkFor in context) return done();

    setTimeout(function() {
      waitUntilExists(checkFor, context, done);
    }, RECHECK_DELAY_MS);
  }

  var jwCrypto, loading, waiting = [];
  function requireJWCrypto(randomSeed, done) {
    if (jwCrypto) {
      done(jwCrypto);
    }
    else if (loading) {
      waiting.push(done);
    }
    else {
      addScript("/production/bidbundle.js");
      waiting.push(done);
      loading = true;
      waitUntilExists("require", window, function() {
        jwCrypto = window.require('./lib/jwcrypto');
        jwCrypto.addEntropy(randomSeed);
        loading = false;
        _.each(waiting, function(doneFunc) {
          doneFunc(jwCrypto);
        });
      });
    }
  }

  var Module = {
    /**
     * If not already done, load up JWCrypto.
     *
     * @method load
     */
    load: function(onSuccess, onFailure) {
      network.withContext(function(context) {
        requireJWCrypto(context.random_seed, onSuccess);
      }, onFailure);
    }
  };

  return Module;
}());

