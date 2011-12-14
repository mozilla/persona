/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla BrowserID.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
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
}());

