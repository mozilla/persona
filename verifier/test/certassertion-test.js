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
 *     Ben Adida <benadida@mozilla.com>
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

var vows = require("vows"),
    assert = require("assert"),
    certassertion = require("../lib/certassertion"),
    jwk = require("../../lib/jwcrypto/jwk"),
    jwt = require("../../lib/jwcrypto/jwt"),
    jwcert = require("../../lib/jwcrypto/jwcert"),
    vep = require("../../lib/jwcrypto/vep"),
    events = require("events");

vows.describe('certassertion').addBatch({
  "generate and certify key + assertion" : {
    topic: function() {
      // generate a key
      var root_kp = jwk.KeyPair.generate("RS", 64);
      var user_kp = jwk.KeyPair.generate("RS", 64);
      var cert = new jwcert.JWCert("fakeroot.com", new Date(), user_kp.publicKey, {email:"user@fakeroot.com"}).sign(root_kp.secretKey);
      var assertion = new jwt.JWT(null, new Date(), "rp.com").sign(user_kp.secretKey);

      var self = this;
      var bundle = vep.bundleCertsAndAssertion([cert],assertion);
      
      // verify it
      certassertion.verify(
        bundle, "rp.com",
        function(email, audience, expires) {
          self.callback({email:email, audience: audience, expires:expires});
        },
        function(msg) {},
        function(issuer, next) {
          if (issuer == "fakeroot.com")
            next(root_kp.publicKey);
          else
            next(null);
        });
    },
    "is successful": function(res, err) {
      assert.notEqual(res.email, null);
    }
  }
}).export(module);