#!/usr/bin/env node

/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla BrowserID.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

require('./lib/test_env.js');

const assert = require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
email = require('../lib/email.js'),
ca = require('../lib/ca.js'),
jwcert = require('jwcrypto/jwcert'),
jwk = require('jwcrypto/jwk'),
jws = require('jwcrypto/jws');

var suite = vows.describe('ca');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

// generate a public key
var kp = jwk.KeyPair.generate("RS",64);

var email_addr = "foo@foo.com";

// certify a key
suite.addBatch({
  "certify a public key": {
    topic: function() {
      var expiration = new Date();
      expiration.setTime(new Date().valueOf() + 5000);
      return ca.certify(email_addr, kp.publicKey, expiration);
    },
    "parses" : function(cert_raw, err) {
      var cert = ca.parseCert(cert_raw);
      assert.notEqual(cert, null);
    },
    "verifies": function(cert_raw, err) {
      // FIXME we might want to turn this into a true async test
      // rather than one that is assumed to be synchronous although
      // it has an async structure
      ca.verifyChain([cert_raw], function(pk) {
        assert.isTrue(kp.publicKey.equals(pk));
      });
    }
  },
  "certify a chain of keys": {
  }
});

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
