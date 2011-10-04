/*jshint browsers:true, forin: true, laxbreak: true */
/*global steal: true, test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserID:true */
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
steal.plugins("jquery", "funcunit/qunit").then("/dialog/resources/storage", function() {
  var storage = BrowserID.Storage;

  module("BrowserID.Storage", {
    startup: function() {
      storage.clearEmails();
    },

    teardown: function() {
      storage.clearEmails();
    }
  });

  test("getEmails with no emails", function() {
    var emails = storage.getEmails();

    equal("object", typeof emails, "no emails returns empty object");
    equal(_.size(emails), 0, "object should be empty");
  });

  test("addEmail, getEmails", function() {
    storage.addEmail("testuser@testuser.com", {priv: "key"});

    var emails = storage.getEmails();
    equal(_.size(emails), 1, "object should have one item");
    ok("testuser@testuser.com" in emails, "added email address is there");
  });


  test("removeEmail, getEmails", function() {
    storage.addEmail("testuser@testuser.com", {priv: "key"});
    storage.removeEmail("testuser@testuser.com");

    var emails = storage.getEmails();
    equal(_.size(emails), 0, "object should have no items");
  });


  test("clearEmails", function() {
    storage.addEmail("testuser@testuser.com", {priv: "key"});
    storage.clearEmails();

    var emails = storage.getEmails();
    equal(_.size(emails), 0, "object should have no items");
  });

  test("invalidateEmail", function() {
    storage.addEmail("testuser@testuser.com", {priv: "key", pub: "pub", cert: "cert"});

    storage.invalidateEmail("testuser@testuser.com");
    var id = storage.getEmails()["testuser@testuser.com"];
    ok(id && !("priv" in id), "private key was removed");
    ok(id && !("pub" in id), "public key was removed");
    ok(id && !("cert" in id), "cert was removed");
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
});

