/*jshint browsers:true, forin: true, laxbreak: true */
/*global test: true, start: true, stop: true, module: true, ok: true, equal: true, BrowserIDNetwork: true */
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
/**
 * This test assumes for authentication that there is a user named 
 * "testuser@testuser.com" with the password "testuser"
 */
steal.plugins("jquery", "funcunit/qunit").then("/dialog/resources/browserid-network", function() {
  "use strict";

  var network = BrowserIDNetwork;
  var xhr = {
    results: {
      "get /wsapi/csrf valid": "csrf_token", 
      "get /wsapi/csrf invalid": "csrf_token",  // since CSRF is called for most everything, it is always valid, the valid/invalid flags are for the other wsapi calls
      "post /wsapi/authenticate_user valid": "true",  
      "post /wsapi/authenticate_user invalid": "false",
      "get /wsapi/am_authed valid": "true",
      "get /wsapi/am_authed invalid": "false",
      "get /wsapi/prove_email_ownership valid": "true",
      "get /wsapi/prove_email_ownership invalid": "false",
      "post /wsapi/stage_user valid": "true",
      "post /wsapi/stage_user invalid": "false",
      "get /wsapi/user_creation_status?email=address notcreated": undefined, // undefined because server returns 400 error
      "get /wsapi/user_creation_status?email=address pending": "pending",
      "get /wsapi/user_creation_status?email=address complete": "complete",
      "post /wsapi/logout valid": "true",
      "get /wsapi/have_email?email=taken valid": "false",
      "get /wsapi/have_email?email=nottaken valid" : "true",
      "post /wsapi/remove_email valid": "true",
      "post /wsapi/remove_email invalid": "false",
      "post /wsapi/account_cancel valid": "true",
      "post /wsapi/account_cancel invalid": "false",
      "post /wsapi/stage_email valid": "true",
      "get /wsapi/email_addition_status?email=address notcreated": undefined, // undefined because server returns 400 error
      "get /wsapi/email_addition_status?email=address pending": "pending",
      "get /wsapi/email_addition_status?email=address complete": "complete",
    },

    useResult: function(result) {
      xhr.resultType = result;
    },

    getLastRequest: function() {
      return this.req;
    },

    ajax: function(obj) {
      console.log("ajax request");
      var type = obj.type ? obj.type.toLowerCase() : "get";

      var req = this.req = {
        type: type,
        url: obj.url,
        data: obj.data
      };

      var resName = req.type + " " + req.url + " " + xhr.resultType;
      var result = xhr.results[resName];

      if(result) {
        if(obj.success) {
          obj.success(result);
        }
      }
      else if (obj.error) {
        // Invalid result - either invalid URL, invalid GET/POST or 
        // invalid resultType
        obj.error();
      }
    }
  }


  module("browserid-network", {
    setup: function() {
      network.setXHR(xhr);
      xhr.useResult("valid");
    },
    teardown: function() {
      network.setXHR($);
    }
  });


  test("setOrigin", function() {
    network.setOrigin("https://www.mozilla.com");

    equal("www.mozilla.com", network.origin, "origin's are properly filtered");
  });


  test("authenticate with valid user", function() {
    network.authenticate("testuser@testuser.com", "testuser", function onSuccess(authenticated) {
      start();
      equal(true, authenticated, "valid authentication");
    }, function onFailure() {
      start();
      ok(false, "valid authentication");
    });

    stop();
  });

  test("authenticate with invalid user", function() {
    xhr.useResult("invalid");
    network.authenticate("testuser@testuser.com", "invalid", function onSuccess(authenticated) {
      start();
      equal(false, authenticated, "invalid authentication");
    }, function onFailure() {
      start();
      ok(false, "invalid authentication");
    });

    stop();
  });

  test("checkAuth with valid authentication", function() {
    network.checkAuth(function onSuccess(authenticated) {
      start();
      equal(true, authenticated, "we have an authentication");
    }, function onFailure() {
      start();
      ok(false, "checkAuth failure");
    });

    stop();
  });

  test("checkAuth with invalid authentication", function() {
    xhr.useResult("invalid");

    network.checkAuth(function onSuccess(authenticated) {
      start();
      equal(false, authenticated, "we are not authenticated");
    }, function onFailure() {
      start();
      ok(false, "checkAuth failure");
    });

    stop();
  });

  test("logout", function() {
    network.logout(function onSuccess() {
      start();
      ok(true, "we can logout");
    }, function onFailure() {
      start();
      ok(false, "logout failure");
    });

    stop();
  });


  test("prove_email_ownership valid", function() {
    network.proveEmailOwnership("goodtoken", function onSuccess(proven) {
      equal(proven, true, "good token proved");
      start(); 
    }, function onFailure() {
      start();
    });

    stop();
  });

  test("prove_email_ownership with invalid token", function() {
    xhr.useResult("invalid");
    network.proveEmailOwnership("badtoken", function onSuccess(proven) {
      equal(proven, false, "bad token could not be proved");
      start(); 
    }, function onFailure() {
      start();
    });

    stop();
  });

  test("createUser with valid user", function() {
    network.createUser("validuser", function onSuccess() {
      start();
      // XXX need to test here
    }, function onFailure() {
      start();
    });

    stop();
  });

  test("createUser with invalid user", function() {
    xhr.useResult("invalid");
    network.createUser("invaliduser", function onSuccess() {
      start();
      // XXX need a test here.
    }, function onFailure() {
      start();
    });

    stop();
  });

  test("checkUserRegistration with pending email", function() {
    xhr.useResult("pending");

    network.checkUserRegistration("address", function(status) {
      equal(status, "pending");
      start();
    }, function onFailure() {
      ok(false);
      start();
    });

    stop();
  });

  test("checkUserRegistration with complete email", function() {
    xhr.useResult("complete");

    network.checkUserRegistration("address", function(status) {
      equal(status, "complete");
      start();
    }, function onFailure() {
      ok(false);
      start();
    });

    stop();
  });

  test("cancelUser valid", function() {
    network.cancelUser(function() {
      // XXX need a test here.
      ok(true);
      start();
    }, function onFailure() {
      start();
    });

    stop();
  });

  test("cancelUser invalid", function() {
    xhr.useResult("invalid");
    network.cancelUser(function() {
      // XXX need a test here.
      ok(true);
      start();
    }, function onFailure() {
      start();
    });

    stop();
  });

  test("emailRegistered with taken email", function() {
    network.emailRegistered("taken", function(have) {
      equal(have, true, "a taken email is marked taken");
      start();
    }, function onFailure() {
      ok(false);
      start();
    });

    stop();
  });

  test("emailRegistered with nottaken email", function() {
    network.emailRegistered("nottaken", function(have) {
      equal(have, false, "a not taken email is not marked taken");
      start();
    }, function onFailure() {
      ok(false);
      start();
    });

    stop();
  });


  test("addEmail valid", function() {
    network.addEmail("address", function onSuccess() {
      // XXX needs a valid test
      ok(true);
      start();
    }, function onFailure() {
      ok(false);
      start();
    });

    stop();
  });

  test("checkEmailRegistration pending", function() {
    xhr.useResult("pending");

    network.checkEmailRegistration("address", function(status) {
      equal(status, "pending");
      start();
    }, function onFailure() {
      ok(false);
      start();
    });

    stop();

  });

  test("checkEmailRegistration complete", function() {
    xhr.useResult("complete");

    network.checkEmailRegistration("address", function(status) {
      equal(status, "complete");
      start();
    }, function onFailure() {
      ok(false);
      start();
    });

    stop();


  });


  test("removeEmail valid", function() {
    network.removeEmail("validemail", function onSuccess() {
      // XXX need a test here;
      ok(true);
      start();
    }, function onFailure() {
      ok(false);
      start();
    });

    stop();
  });

  test("removeEmail invalid", function() {
    xhr.useResult("invalid");
    network.removeEmail("invalidemail", function onSuccess() {
      // XXX need a test here;
      ok(true);
      start();
    }, function onFailure() {
      ok(false);
      start();
    });

    stop();
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
