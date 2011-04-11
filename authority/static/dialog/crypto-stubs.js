// This file is a stub of the cryptographic routines that will be required
// for firefoxid's client side implementation
CryptoStubs = (function() {
  function randomString(length) {
    if (typeof length !== 'number') length = 64;
    var str = "";
    var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i=0; i < length; i++) {
      str += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }

    return str;
  }

  function genKeyPair() {
    // fake keypairs.  they're a random string with pub or priv prepended.
    var fakeKey = randomString();
    return {
      pub: "pub:" + fakeKey,
      priv: "priv:" + fakeKey
    };
  }

  function createAssertion(audience, email, privkey) {
    // XXX: in the future, we need to sign via JWT spec, now let's just glom together and stringify
    return JSON.stringify({
      audience: audience,
      email: email,
      "valid-until": (new Date()).getTime() + (1000 * 120) // 2 mins from now.
    });
  }

  return {
    genKeyPair: genKeyPair,
    createAssertion: createAssertion
  };
})();
