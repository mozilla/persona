/**
 * This test assumes for authentication that there is a user named 
 * "testuser@testuser.com" with the password "testuser"
 */
steal.plugins("jquery", "funcunit/qunit").then("/dialog/resources/browserid-network", function() {
  module("browserid-network");
  
  test("setOrigin", function() {
    BrowserIDNetwork.setOrigin("https://www.mozilla.com");

    equal("www.mozilla.com", BrowserIDNetwork.origin, "origin's are properly filtered");
  });


  test("authenticate with valid user", function() {
    BrowserIDNetwork.authenticate("testuser@testuser.com", "testuser", function onSuccess(authenticated) {
      start();
      equal(true, authenticated, "valid authentication");
    }, function onFailure() {
      start();
      ok(false, "valid authentication");
    });

    stop();
  });

  test("authenticate with invalid user", function() {
    BrowserIDNetwork.authenticate("testuser@testuser.com", "invalid", function onSuccess(authenticated) {
      start();
      equal(false, authenticated, "invalid authentication");
    }, function onFailure() {
      start();
      ok(false, "invalid authentication");
    });

    stop();
  });

  test("checkAuth", function() {
    BrowserIDNetwork.authenticate("testuser@testuser.com", "testuser", function onSuccess(authenticated) {
      BrowserIDNetwork.checkAuth(function onSuccess(authenticated) {
        start();
        equal(true, authenticated, "we have an authentication");
      }, function onFailure() {
        start();
        ok(false, "checkAuth failure");
      });
    }, function onFailure() {
      start();
      ok(false, "valid authentication");
    });

    stop();
  });

  test("logout->checkAuth: are we really logged out?", function() {
    BrowserIDNetwork.authenticate("testuser@testuser.com", "testuser", function onSuccess(authenticated) {
      BrowserIDNetwork.logout(function onSuccess(authenticated) {
        BrowserIDNetwork.checkAuth(function onSuccess(authenticated) {
          start();
          equal(false, authenticated, "after logout, we are not authenticated");
        }, function onFailure() {
          start();
          ok(false, "checkAuth failure");
        });
      });
    });

    stop();
  });

  test("stageUser", function() {
    ok(true, "stageUser");
  });

  test("haveEmail", function() {
    ok(true, "haveEmail");
  });

  test("removeEmail", function() {
    ok(true, "removeEmail");
  });

  test("checkRegistration", function() {
    ok(true, "checkRegistration");
  });

  test("setKey", function() {
    ok(true, "setKey");
  });

  test("syncEmails", function() {
    ok(true, "syncEmails");
  });
});
