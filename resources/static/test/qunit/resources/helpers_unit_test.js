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
  "use strict";

  var bid = BrowserID,
      helpers = bid.Helpers,
      dialogHelpers = helpers.Dialog,
      network = bid.Network,
      xhr = bid.Mocks.xhr,
      user = bid.User,
      storage = bid.Storage,
      tooltip = bid.Tooltip,
      closeCB,
      errorCB;

  var controllerMock = {
    close: function(message, info) {
      closeCB && closeCB(message, info);
    },

    getErrorDialog: function(info) {
      return function() {
        errorCB && errorCB(info);
      }
    }
  };

  function expectedClose(message, field, value) {
    return function(m, info) {
      ok(m, message, "correct message: " + message);

      if(value) {
        equal(info[field], value, field + " has correct value of " + value);
      }
      else {
        ok(info[field], field + " has a value");
      }
    }
  }

  function badError() {
    ok(false, "error should have never been called");
  }

  function expectedError() {
    ok(true, "error condition expected");
    start();
  }

  function badClose() {
    ok(false, "close should have never been called");
  }

  module("resources/helpers", {
    setup: function() {
      network.setXHR(xhr);
      xhr.useResult("valid");
      storage.clear();
      closeCB = errorCB = null;
      errorCB = badError;
    },

    teardown: function() {
      network.setXHR($);
    }
  });

  asyncTest("getAssertion happy case", function() {
    closeCB = expectedClose("assertion_generated", "assertion");

    storage.addEmail("registered@testuser.com", {});
    dialogHelpers.getAssertion.call(controllerMock, "registered@testuser.com", function(assertion) {
      ok(assertion, "assertion given to close");
      start();
    });

    
  });

  asyncTest("getAssertion with XHR error", function() {
    closeCB = badClose;
    errorCB = expectedError;

    xhr.useResult("ajaxError");
    storage.addEmail("registered@testuser.com", {});
    dialogHelpers.getAssertion.call(controllerMock, "registered@testuser.com", function() {
      ok(false, "unexpected finish");
      start();  
    });
    
  });

  asyncTest("authenticateUser happy case", function() {
    dialogHelpers.authenticateUser.call(controllerMock, "testuser@testuser.com", "password", function(authenticated) {
      equal(authenticated, true, "user is authenticated");
      start();
    });

    
  });

  asyncTest("authenticateUser invalid credentials", function() {
    xhr.useResult("invalid");
    dialogHelpers.authenticateUser.call(controllerMock, "testuser@testuser.com", "password", function(authenticated) {
      equal(authenticated, false, "user is not authenticated");
      start();
    });

    
  });

  asyncTest("authenticateUser XHR error", function() {
    errorCB = expectedError;

    xhr.useResult("ajaxError");
    dialogHelpers.authenticateUser.call(controllerMock, "testuser@testuser.com", "password", function() {
      ok(false, "unexpected success callback");
      start();
    });

    
  });

  asyncTest("createUser happy case", function() {
    closeCB = expectedClose("user_staged", "email", "unregistered@testuser.com");

    dialogHelpers.createUser.call(controllerMock, "unregistered@testuser.com", function(staged) {
      equal(staged, true, "user was staged");
      start(); 
    });

    
  });

  asyncTest("createUser could not create case", function() {
    closeCB = badClose;

    xhr.useResult("invalid");
    dialogHelpers.createUser.call(controllerMock, "registered@testuser.com", function(staged) {
      equal(staged, false, "user was not staged");
      start();
    });

    
  });


  asyncTest("createUser with XHR error", function() {
    errorCB = expectedError;

    xhr.useResult("ajaxError");
    dialogHelpers.createUser.call(controllerMock, "registered@testuser.com", function(staged) {
      ok(false, "complete should not have been called");
      start();
    });
    
  });

  asyncTest("addEmail happy case", function() {
    closeCB = expectedClose("email_staged", "email", "unregistered@testuser.com");
    dialogHelpers.addEmail.call(controllerMock, "unregistered@testuser.com", function(added) {
      ok(added, "email added");
      start();
    });

    
  });


  asyncTest("addEmail throttled", function() {
    xhr.useResult("throttle");
    dialogHelpers.addEmail.call(controllerMock, "unregistered@testuser.com", function(added) {
      equal(added, false, "email not added");
      start();
    });

    
  });

  asyncTest("addEmail with XHR error", function() {
    errorCB = expectedError;

    xhr.useResult("ajaxError");
    dialogHelpers.addEmail.call(controllerMock, "unregistered@testuser.com", function(added) {
      ok(false, "unexpected close");
      start();
    });

    
  });

  asyncTest("resetPassword happy case", function() {
    closeCB = expectedClose("reset_password", "email", "registered@testuser.com");
    dialogHelpers.resetPassword.call(controllerMock, "registered@testuser.com", function(reset) {
      ok(reset, "password reset");
      start();
    });

    
  });


  asyncTest("resetPassword throttled", function() {
    xhr.useResult("throttle");
    dialogHelpers.resetPassword.call(controllerMock, "registered@testuser.com", function(reset) {
      equal(reset, false, "password not reset");
      start();
    });

    
  });

  asyncTest("resetPassword with XHR error", function() {
    errorCB = expectedError;

    xhr.useResult("ajaxError");
    dialogHelpers.resetPassword.call(controllerMock, "registered@testuser.com", function(reset) {
      ok(false, "unexpected close");
      start();
    });

    
  });
}());



