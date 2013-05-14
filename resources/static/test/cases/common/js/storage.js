/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  var bid = BrowserID,
      storage = bid.Storage,
      testHelpers = bid.TestHelpers,
      TEST_ORIGIN = "http://test.domain";

  module("common/js/storage", {
    setup: function() {
      storage.clear();
    },

    teardown: function() {
      storage.clear();
    }
  });

  test("getEmails, getEmailCount with no emails", function() {
    var emails = storage.getEmails();

    equal("object", typeof emails, "no emails returns empty object");
    equal(_.size(emails), 0, "object should be empty");
    equal(storage.getEmailCount(), 0, "no emails");
  });

  test("addEmail, getEmails, getEmail", function() {
    storage.addEmail("testuser@testuser.com", {priv: "key"});

    var emails = storage.getEmails();
    equal(_.size(emails), 1, "object should have one item");
    equal(storage.getEmailCount(), 1, "a single email has been added");
    ok("testuser@testuser.com" in emails, "added email address is there");

    var id = storage.getEmail("testuser@testuser.com");
    equal("key", id.priv, "email that was added is retrieved");
  });

  test("removeEmail, getEmails", function() {
    storage.addEmail("testuser@testuser.com", {priv: "key"});
    storage.removeEmail("testuser@testuser.com");

    var emails = storage.getEmails();
    equal(_.size(emails), 0, "object should have no items");
  });

  test("removeEmail with invalid address", function() {
    var error;
    try {
      storage.removeEmail("testuser@testuser.com");
    }
    catch(e) {
      error = e;
    }
    equal(error.message, "unknown email address", "removing an unknown email address");
  });


  test("clear - there should be default values", function() {
    storage.addEmail("testuser@testuser.com", {priv: "key"});
    storage.clear();

    var emails = storage.getEmails();
    equal(_.size(emails), 0, "object should have no items");

    // all fields *MUST* have default values or else synchronization of
    // localStorage in IE8 across multiple browsing contexts becomes a problem.
    // See issue #2206 and #1637
    notEqual(typeof localStorage.emails, "undefined", "emails is defined");
    notEqual(typeof localStorage.siteInfo, "undefined", "siteInfo is defined");
    notEqual(typeof localStorage.managePage, "undefined", "managePage is defined");
  });

  test("invalidateEmail with valid email address", function() {
    storage.addEmail("testuser@testuser.com", {priv: "key", pub: "pub", cert: "cert"});

    storage.invalidateEmail("testuser@testuser.com");
    var id = storage.getEmail("testuser@testuser.com");
    ok(id && !("priv" in id), "private key was removed");
    ok(id && !("pub" in id), "public key was removed");
    ok(id && !("cert" in id), "cert was removed");
  });

  test("invalidateEmail with invalid email address", function() {
    var error;
    try {
      storage.invalidateEmail("testuser@testuser.com");
    }
    catch(e) {
      error = e;
    }
    equal(error.message, "unknown email address", "Invalidating an unknown email address");
  });

  test("site.set/site.get/site.remove/site.count, happy case", function() {
    storage.site.set("www.testsite.com", "autoauth", true);
    equal(storage.site.get("www.testsite.com", "autoauth"), true, "set/get works correctly");
    equal(storage.site.count(), 1, "correct count");

    storage.site.remove("www.testsite.com", "autoauth");
    equal(typeof storage.site.get("www.testsite.com", "autoauth"), "undefined", "after remove, get returns undefined");

    equal(storage.site.count(), 0, "last field for site removed, count decremented correctly");
  });

  test("clear clears site info", function() {
    storage.site.set("www.testsite.com", "autoauth", true);
    storage.clear();
    equal(storage.site.count(), 0, "no more sites after clear");
    equal(typeof storage.site.get("www.testsite.com", "autoauth"), "undefined", "after clear, get returns undefined");
  });

  test("site.get on field for site with no info", function() {
    equal(typeof storage.site.get("site.with.noinfo", "autoauth"), "undefined", "get works on site with no info");
  });

  test("site.get on field that is not set", function() {
    equal(typeof storage.site.get("www.testsite.com", "notset"), "undefined", "get works on undefined field");
  });

  test("site.set->email with email that is not known about", function() {
    var error;
    try {
      storage.site.set("www.testsite.com", "email", "testuser@testuser.com");
    } catch(e) {
      error = e;
    }

    equal(error.message, "unknown email address", "An unknown email address was added");
  });

  test("site.set->email with valid email", function() {
    storage.addEmail("testuser@testuser.com", {});
    storage.site.set("www.testsite.com", "email", "testuser@testuser.com");
    var email = storage.site.get("www.testsite.com", "email");

    equal(email, "testuser@testuser.com", "set/get have the same email for the site");
  });

  test("removeEmail after site.set->email removes email", function() {
    storage.addEmail("testuser@testuser.com", {});
    storage.site.set("www.testsite.com", "email", "testuser@testuser.com");
    storage.removeEmail("testuser@testuser.com");
    var email = storage.site.get("www.testsite.com", "email");

    equal(typeof email, "undefined", "after removing an email address, email for site is no longer available");
  });

  test("user.manage_page.set", function() {
    storage.manage_page.set("user_has_visited", true);

    equal(storage.manage_page.get("user_has_visited"), true, "user_has_visited set correctly");

    storage.clear();
    equal(typeof storage.manage_page.get("user_has_visited"), "undefined", "after reset, user_has_visited reset correctly");
  });
  test("setReturnTo", function() {
    storage.setReturnTo("http://some.domain/path");
    equal(storage.getReturnTo(), "http://some.domain/path", "setReturnTo/getReturnTo working as expected");
  });

  test("site.set->logged_in, site.get->logged_in, loggedInCount", function() {
    var email = "testuser@testuser.com";
    storage.addEmail(email, {});
    storage.site.set(TEST_ORIGIN, "logged_in", email);
    storage.site.set("http://another.domain", "logged_in", email);

    equal(storage.loggedInCount(), 2, "correct logged in count");

    storage.removeEmail(email);
    equal(storage.loggedInCount(), 0, "after email removed, not logged in anywhere");
    testHelpers.testUndefined(storage.site.get(TEST_ORIGIN, "logged_in"), "sites with email no longer logged in");
  });

  // BEGIN TRANSITION CODE
  test("upgradeLoggedInInfo upgrades old loggedInInfo and removes namespace",
      function() {
      localStorage.loggedIn = JSON.stringify({
        'testrp.com': 'testuser@testuser.com'
      });

      storage.upgradeLoggedInInfo();
      equal(storage.site.get("testrp.com", "logged_in"),
          'testuser@testuser.com');

      equal(localStorage.getItem('loggedIn'), null);

      try {
        // make sure re-invoking upgrade path does not cause an error.
        storage.upgradeLoggedInInfo();
      } catch(e) {
        ok(false, "unexpected error");
      }
  });
  // END TRANSITION CODE

}());

