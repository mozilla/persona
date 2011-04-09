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

  return {
    genKeyPair: genKeyPair
  };
})();
