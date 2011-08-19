steal.plugins("funcunit/qunit").then("/dialog/resources/browserid-network", function() {
  module("browserid-network");
  
  test("setOrigin", function() {
    BrowserIDNetwork.setOrigin("https://www.mozilla.com");

    equal("www.mozilla.com", BrowserIDNetwork.origin, "origin's are properly filtered");
  });
});
