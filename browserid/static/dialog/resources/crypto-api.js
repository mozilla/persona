/*global CryptoStubs:true */
// This file is the cryptographic routines that are required for
// BrowserID's HTML5 implementation

CryptoStubs = (function() {
  function genKeyPair() {
    // fake keypairs.  they're a random string with pub or priv prepended.
    var key = new RSAKey();
    key.generate(512, "10001");

    // hm.  PEM encoding, anyone?
    return {
      pub: key.serializePublicASN1(),
      priv: key.serializePrivateASN1()
    };
  }

  function createAssertion(audience, email, privkey, issuer) {
    var assertion = {
      audience: audience,
      email: email,
      "valid-until": (new Date()).getTime() + (1000 * 120) // 2 mins from now.
    };
    if (issuer) {
      assertion.issuer = issuer;
    }

    var token = new jwt.WebToken(JSON.stringify(assertion), JSON.stringify({alg:"RS256"}));
    var signed = token.serialize(privkey);
    return signed;
  }

  return {
    genKeyPair: genKeyPair,
    createAssertion: createAssertion
  };
})();

