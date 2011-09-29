steal("/dialog/resources/storage.js",
      "/dialog/resources/underscore-min.js")
  .plugins("funcunit/qunit")
  .then("browserid-network_test")
  .then("browserid-identities_unit_test")
