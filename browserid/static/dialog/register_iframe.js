/*jshint browser:true, jQuery: true, forin: true */
/*global Channel:true, CryptoStubs:true, alert:true, errorOut:true */
 
// this is the picker code!  it runs in the identity provider's domain, and
// fiddles the dom expressed by picker.html
(function() {
  var chan = Channel.build(
    {
      window: window.parent,
      origin: "*",
      scope: "mozid"
    });

    function persistAddressAndKeyPair(email, keypair, issuer)
    {
        var emails = {};
        if (window.localStorage.emails) {
            emails = JSON.parse(window.localStorage.emails);
        }

        emails[email] = {
            created: new Date(),
            pub: keypair.pub,
            priv: keypair.priv
        };
        if (issuer) {
            emails[email].issuer = issuer;
        }
        window.localStorage.emails = JSON.stringify(emails);
    }

    chan.bind("registerVerifiedEmail", function(trans, args) {
        // This is a primary registration - the persisted
        // identity does not have an issuer because it 
        // was directly asserted by the controlling domain.

        var keypair = CryptoStubs.genKeyPair();
        persistAddressAndKeyPair(args.email, keypair);
        return keypair.pub;
    });

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
})();
