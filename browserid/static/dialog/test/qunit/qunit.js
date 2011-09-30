steal("/dialog/resources/browserid.js",
      "/dialog/resources/storage.js",
      "/dialog/resources/underscore-min.js")
  .plugins("funcunit/qunit")
  .then("browserid-storage_unit_test")
  .then("browserid-network_test")
  .then("browserid-identities_unit_test")
