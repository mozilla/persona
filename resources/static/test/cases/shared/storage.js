/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  var storage = BrowserID.Storage;

  module("shared/storage", {
    setup: function() {
      storage.clear();
    },

    teardown: function() {
      storage.clear();
    }
  });

  test("getEmails with no emails", function() {
    var emails = storage.getEmails();

    equal("object", typeof emails, "no emails returns empty object");
    equal(_.size(emails), 0, "object should be empty");
  });

  test("addEmail, getEmails, getEmail", function() {
    storage.addEmail("testuser@testuser.com", {priv: "key"});

    var emails = storage.getEmails();
    equal(_.size(emails), 1, "object should have one item");
    ok("testuser@testuser.com" in emails, "added email address is there");

    var id = storage.getEmail("testuser@testuser.com");
    equal("key", id.priv, "email that was added is retrieved");
  });

  test("addPrimaryEmail", function() {
    storage.addPrimaryEmail("testuser@testuser.com");

    var email = storage.getEmail("testuser@testuser.com");
    equal(email.type, "primary", "email type set correctly");
  });

  test("addSecondaryEmail", function() {
    storage.addSecondaryEmail("testuser@testuser.com");

    var email = storage.getEmail("testuser@testuser.com");
    equal(email.type, "secondary", "email type set correctly");
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
    equal(error.toString(), "unknown email address", "removing an unknown email address");
  });


  test("clear", function() {
    storage.addEmail("testuser@testuser.com", {priv: "key"});
    storage.clear();

    var emails = storage.getEmails();
    equal(_.size(emails), 0, "object should have no items");
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
    equal(error.toString(), "unknown email address", "Invalidating an unknown email address");
  });

  test("site.set/site.get/site.remove, happy case", function() {
    storage.site.set("www.testsite.com", "autoauth", true);
    equal(storage.site.get("www.testsite.com", "autoauth"), true, "set/get works correctly");

    storage.site.remove("www.testsite.com", "autoauth");
    equal(typeof storage.site.get("www.testsite.com", "autoauth"), "undefined", "after remove, get returns undefined");
  });

  test("clear clears site info", function() {
    storage.site.set("www.testsite.com", "autoauth", true);
    storage.clear();
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

    equal(error.toString(), "unknown email address", "An unknown email address was added");
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

  test("storeTemporaryKeypair", function() {
    // XXX needs a test
  });

  test("retrieveTemporaryKeypair", function() {
    // XXX needs a test
  });

  test("setStagedOnBehalfOf", function() {
    // XXX needs a test
  });

  test("getStagedOnBehalfOf", function() {
    // XXX needs a test
  });

  test("signInEmail.set/.get/.remove - set, get, and remove the signInEmail", function() {
    storage.signInEmail.set("testuser@testuser.com");
    equal(storage.signInEmail.get(), "testuser@testuser.com", "correct email gotten");
    storage.signInEmail.remove();
    equal(typeof storage.signInEmail.get(), "undefined", "after remove, signInEmail is empty");
  });
}());

