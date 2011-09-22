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

// this is the picker code!  it runs in the identity provider's domain, and
// fiddles the dom expressed by picker.html

var jwk = require("./jwk"),
    jwcert = require("./jwcert"),
    vep = require("./vep");

(function() {
  var chan = Channel.build(
    {
      window: window.parent,
      origin: "*",
      scope: "mozid"
    });

  //
  // for now, DISABLE primary support
  //

  /*
  // primary requests a keygen to certify  
  chan.bind("generateKey", function(trans, args) {
    // keygen
    var keypair = jwk.KeyPair.generate(vep.params.algorithm, 64);

    // save it in a special place for now
    BrowserIDStorage.storeTemporaryKeypair(keypair);
    
    // serialize and return
    return keypair.publicKey.serialize();
  });

  // add the cert 
  chan.bind("registerVerifiedEmailCertificate", function(trans, args) {
    var keypair = BrowserIDStorage.retrieveTemporaryKeypair();

    // parse the cert
    var raw_cert = args.cert;
    var cert = new jwcert.JWCert();
    cert.parse(raw_cert);
    var email = cert.principal.email;
    var pk = cert.pk;

    // check if the pk's match
    if (!pk.equals(keypair.publicKey)) {
      trans.error("bad cert");
      return;
    }
    
    var new_email_obj= {
      created: new Date(),
      pub: keypair.publicKey.toSimpleObject(),
      priv: keypair.secretKey.toSimpleObject(),
      cert: raw_cert,
      issuer: cert.issuer,
      isPrimary: true
    };

    BrowserIDStorage.addEmail(email, new_email_obj);
  });
  */

  // reenable this once we're ready
  /*
    function isSuperDomain(domain) {
        return true;
    }

    // from
    // http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
    function new_guid() {
        var S4 = function() {
            return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
        };
        return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
    }
    
    // pre-auth binding
    chan.bind("preauthEmail", function(trans, email) {
        if (!isSuperDomain(trans.origin)) {
            alert('not a super domain!');
            return;
        }
        
        // only one preauth, since this shouldn't happen in parallel
        var guid = new_guid();
        window.localStorage['PREAUTH_' + guid] = JSON.stringify({'at': new Date(), 'email': email});
        
        // the guid is returned, it will be used to actually perform
        // the headless verification of email address
        return guid;
    });

    // this version of getSpecificVerifiedEmail
    // requires a token in the params, as it is called only in the IFRAME
    chan.bind("getSpecificVerifiedEmail", function(trans, params) {
        var email = params[0], token = params[1];
        trans.delayReturn(true);
        
        var remoteOrigin = trans.origin;
        
        // check to see if there's any pubkeys stored in the browser
        var haveIDs = false;
        try {
            var emails = JSON.parse(window.localStorage.emails);
            if (typeof emails !== 'object') throw "emails blob bogus!";
            for (var k in emails) {
                if (!emails.hasOwnProperty(k)) continue;
                haveIDs = true;
                break;
            }
        } catch(e) {
            window.localStorage.emails = JSON.stringify({});
        }
        
        function onsuccess(rv) {
            trans.complete(rv);
        }
        function onerror(error) {
            errorOut(trans, error);
        }
        
        // wherever shall we start?
        if (haveIDs) {
            // can we pre-approve this?
            var preauth = null;
            if (window.localStorage['PREAUTH_' + token]) {
                preauth = JSON.parse(window.localStorage['PREAUTH_' + token]);
            }
            if (token && preauth) {
                window.localStorage['PREAUTH_' + token] = null;
                var storedID = JSON.parse(window.localStorage.emails)[email];
                if (storedID  && (email == preauth.email)) {
                    // ultimate success, pre-approved for an ID we have!
                    var privkey = storedID.priv;
                    var issuer = storedID.issuer;
                    var audience = remoteOrigin.replace(/^(http|https):\/\//, '');
                    var assertion = CryptoStubs.createAssertion(audience, email, privkey, issuer);
                    onsuccess(assertion);

                    // at this point, we have succeeded, we can stop
                    return;

                    // if we go further than here, we have failed for some reason
                } 
            }
        }

        // if we get here, we've failed
        trans.error("X", "not a proper token-based call");
    });
    */
})();
