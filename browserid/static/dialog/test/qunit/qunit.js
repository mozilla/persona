steal("/dialog/resources/storage.js",
      "/dialog/resources/underscore-min.js",
      "/dialog/resources/crypto-api.js",
      "/dialog/resources/crypto.js")
  .plugins("funcunit/qunit")
  .then("browserid-network_test")
  .then("browserid-identities_test");
