/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.Mocks.xhr = (function() {
  "use strict";

  var delay = 0,
      contextInfo = {
      server_time: new Date().getTime(),
      domain_key_creation_time: (new Date().getTime() - (30 * 24 * 60 * 60 * 1000)),
      csrf_token: "csrf",
      authenticated: false,
      auth_level: undefined,
      code_version: "ABC123",
      random_seed: "H+ZgKuhjVckv/H4i0Qvj/JGJEGDVOXSIS5RCOjY9/Bo=",
      data_sample_rate: 1,
      has_password: false
    };

  // this cert is meaningless, but it has the right format
  var random_cert = "eyJhbGciOiJSUzEyOCJ9.eyJpc3MiOiJpc3N1ZXIuY29tIiwiZXhwIjoxMzE2Njk1MzY3NzA3LCJwdWJsaWMta2V5Ijp7ImFsZ29yaXRobSI6IlJTIiwibiI6IjU2MDYzMDI4MDcwNDMyOTgyMzIyMDg3NDE4MTc2ODc2NzQ4MDcyMDM1NDgyODk4MzM0ODExMzY4NDA4NTI1NTk2MTk4MjUyNTE5MjY3MTA4MTMyNjA0MTk4MDA0NzkyODQ5MDc3ODY4OTUxOTA2MTcwODEyNTQwNzEzOTgyOTU0NjUzODEwNTM5OTQ5Mzg0NzEyNzczMzkwMjAwNzkxOTQ5NTY1OTAzNDM5NTIxNDI0OTA5NTc2ODMyNDE4ODkwODE5MjA0MzU0NzI5MjE3MjA3MzYwMTA1OTA2MDM5MDIzMjk5NTYxMzc0MDk4OTQyNzg5OTk2NzgwMTAyMDczMDcxNzYwODUyODQxMDY4OTg5ODYwNDAzNDMxNzM3NDgwMTgyNzI1ODUzODk5NzMzNzA2MDY5IiwiZSI6IjY1NTM3In0sInByaW5jaXBhbCI6eyJlbWFpbCI6InRlc3R1c2VyQHRlc3R1c2VyLmNvbSJ9fQ.aVIO470S_DkcaddQgFUXciGwq2F_MTdYOJtVnEYShni7I6mqBwK3fkdWShPEgLFWUSlVUtcy61FkDnq2G-6ikSx1fUZY7iBeSCOKYlh6Kj9v43JX-uhctRSB2pI17g09EUtvmb845EHUJuoowdBLmLa4DSTdZE-h4xUQ9MsY7Ik";

  /**
   * This is the responses table, the keys are the request type, url, and
   * a "selector" for testing.  The right is the expected return value, already
   * decoded.  If a result is "undefined", the request's error handler will be
   * called.
   */
  var xhr = {
    // Keep track of the last request made to each wsapi call.  keyed only on
    // url - for instince - instead of "get /wsapi/session_context
    // valid", the key would only be "/wsapi/session_context"
    requests: {},

    responses: {
      "get /wsapi/session_context valid": contextInfo,
      // We are going to test for XHR failures for session_context using
      // the flag contextAjaxError.
      "get /wsapi/session_context contextAjaxError": undefined,
      "get /wsapi/email_for_token?token=token valid": { email: "testuser@testuser.com" },
      "get /wsapi/email_for_token?token=token mustAuth": { email: "testuser@testuser.com", must_auth: true },
      "get /wsapi/email_for_token?token=token needsPassword": { email: "testuser@testuser.com", needs_password: true },
      "get /wsapi/email_for_token?token=token badPassword": { email: "testuser@testuser.com", must_auth: true },
      "get /wsapi/email_for_token?token=token invalid": { success: false },
      "post /wsapi/authenticate_user valid": {
          success: true,
          userid: 1,
          suppress_ask_if_users_computer: false
      },
      "post /wsapi/authenticate_user foreverSession": {
          success: true,
          userid: 1,
          suppress_ask_if_users_computer: true
      },
      "post /wsapi/authenticate_user invalid": { success: false },
      "post /wsapi/authenticate_user incorrectPassword": { success: false },
      "post /wsapi/authenticate_user ajaxError": undefined,
      "post /wsapi/auth_with_assertion primary": {
          success: true,
          userid: 1,
          suppress_ask_if_users_computer: false
      },
      "post /wsapi/auth_with_assertion foreverSession": {
          success: true,
          userid: 1,
          suppress_ask_if_users_computer: true
        },
      "post /wsapi/auth_with_assertion primaryTransition": {
          success: true,
          userid: 1,
          suppress_ask_if_users_computer: false
      },
      "post /wsapi/auth_with_assertion valid": { success: true, userid: 1 },
      "post /wsapi/auth_with_assertion invalid": { success: false },
      "post /wsapi/auth_with_assertion ajaxError": undefined,
      "post /wsapi/cert_key valid": random_cert,
      "post /wsapi/cert_key invalid": undefined,
      "post /wsapi/cert_key ajaxError": undefined,
      "post /wsapi/complete_email_confirmation valid": { success: true },
      "post /wsapi/complete_email_confirmation badPassword": 401,
      "post /wsapi/complete_email_confirmation invalid": { success: false },
      "post /wsapi/complete_email_confirmation ajaxError": undefined,
      "post /wsapi/stage_user unknown_secondary": { success: true },
      "post /wsapi/stage_user valid": { success: true },
      "post /wsapi/stage_user unverified": { success: true, unverified: true },
      "post /wsapi/stage_user invalid": { success: false },
      "post /wsapi/stage_user throttle": 429,
      "post /wsapi/stage_user ajaxError": undefined,

      "post /wsapi/stage_reset unknown_secondary": { success: true },
      "post /wsapi/stage_reset valid": { success: true },
      "post /wsapi/stage_reset invalid": { success: false },
      "post /wsapi/stage_reset throttle": 429,
      "post /wsapi/stage_reset ajaxError": undefined,

      "post /wsapi/complete_reset valid": { success: true },
      "post /wsapi/complete_reset badPassword": 401,
      "post /wsapi/complete_reset invalid": { success: false },
      "post /wsapi/complete_reset ajaxError": undefined,

      "get /wsapi/password_reset_status?email=registered%40testuser.com pending": { status: "pending" },
      "get /wsapi/password_reset_status?email=registered%40testuser.com complete": { status: "complete", userid: 4 },
      "get /wsapi/password_reset_status?email=registered%40testuser.com valid": { status: "complete", userid: 4 },
      "get /wsapi/password_reset_status?email=registered%40testuser.com mustAuth": { status: "mustAuth" },
      "get /wsapi/password_reset_status?email=registered%40testuser.com noRegistration": { status: "noRegistration" },
      "get /wsapi/password_reset_status?email=registered%40testuser.com ajaxError": undefined,

      "post /wsapi/stage_reverify unknown_secondary": { success: true },
      "post /wsapi/stage_reverify valid": { success: true },
      "post /wsapi/stage_reverify invalid": { success: false },
      "post /wsapi/stage_reverify throttle": 429,
      "post /wsapi/stage_reverify ajaxError": undefined,

      "get /wsapi/email_reverify_status?email=registered%40testuser.com pending": { status: "pending" },
      "get /wsapi/email_reverify_status?email=registered%40testuser.com complete": { status: "complete", userid: 4 },
      "get /wsapi/email_reverify_status?email=registered%40testuser.com mustAuth": { status: "mustAuth" },
      "get /wsapi/email_reverify_status?email=registered%40testuser.com noRegistration": { status: "noRegistration" },
      "get /wsapi/email_reverify_status?email=registered%40testuser.com ajaxError": undefined,

      "get /wsapi/user_creation_status?email=registered%40testuser.com pending": { status: "pending" },
      "get /wsapi/user_creation_status?email=registered%40testuser.com complete": { status: "complete", userid: 4 },
      "get /wsapi/user_creation_status?email=registered%40testuser.com valid": { status: "complete", userid: 4 },
      "get /wsapi/user_creation_status?email=unregistered%40testuser.com valid": { status: "complete", userid: 4 },
      "get /wsapi/user_creation_status?email=registered%40testuser.com mustAuth": { status: "mustAuth" },
      "get /wsapi/user_creation_status?email=registered%40testuser.com noRegistration": { status: "noRegistration" },
      "get /wsapi/user_creation_status?email=registered%40testuser.com ajaxError": undefined,
      "post /wsapi/complete_user_creation valid": { success: true },
      "post /wsapi/complete_user_creation badPassword": 401,
      "post /wsapi/complete_user_creation invalid": { success: false },
      "post /wsapi/complete_user_creation ajaxError": undefined,

      "post /wsapi/stage_transition unknown_secondary": { success: true },
      "post /wsapi/stage_transition valid": { success: true },
      "post /wsapi/stage_transition invalid": { success: false },
      "post /wsapi/stage_transition throttle": 429,
      "post /wsapi/stage_transition ajaxError": undefined,

      "post /wsapi/complete_transition valid": { success: true },
      "post /wsapi/complete_transition badPassword": 401,
      "post /wsapi/complete_transition invalid": { success: false },
      "post /wsapi/complete_transition ajaxError": undefined,

      "get /wsapi/transition_status?email=registered%40testuser.com pending": { status: "pending" },
      "get /wsapi/transition_status?email=registered%40testuser.com complete": { status: "complete", userid: 4 },
      "get /wsapi/transition_status?email=registered%40testuser.com valid": { status: "complete", userid: 4 },
      "get /wsapi/transition_status?email=registered%40testuser.com mustAuth": { status: "mustAuth" },
      "get /wsapi/transition_status?email=registered%40testuser.com noRegistration": { status: "noRegistration" },
      "get /wsapi/transition_status?email=registered%40testuser.com ajaxError": undefined,


      "post /wsapi/logout valid": { success: true },
      "post /wsapi/logout not_authenticated": 400,
      "post /wsapi/logout ajaxError": 401,
      "get /wsapi/have_email?email=registered%40testuser.com valid": { email_known: true },
      "get /wsapi/have_email?email=registered%40testuser.com throttle": { email_known: true },
      "get /wsapi/have_email?email=registered%40testuser.com ajaxError": undefined,
      "get /wsapi/have_email?email=testuser%40testuser.com valid": { email_known: true },
      "get /wsapi/have_email?email=testuser%40testuser.com primary": { email_known: true },
      "get /wsapi/have_email?email=testuser%40testuser.com primaryTransition": { email_known: true },
      "get /wsapi/have_email?email=testuser%40testuser.com primaryOffline": { email_known: true },
      "get /wsapi/have_email?email=testuser%40testuser.com throttle": { email_known: true },
      "get /wsapi/have_email?email=testuser%40testuser.com ajaxError": undefined,
      "get /wsapi/have_email?email=unregistered%40testuser.com valid": { email_known: false },
      "get /wsapi/have_email?email=unregistered%40testuser.com primary": { email_known: false },
      "get /wsapi/have_email?email=unregistered%40testuser.com primaryUnknown": { email_known: false },
      "get /wsapi/have_email?email=registered%40testuser.com primary": { email_known: true },
      "get /wsapi/have_email?email=registered%40testuser.com primaryTransition": { email_known: true },
      "post /wsapi/remove_email valid": { success: true },
      "post /wsapi/remove_email invalid": { success: false },
      "post /wsapi/remove_email multiple": { success: true },
      "post /wsapi/remove_email ajaxError": undefined,
      "post /wsapi/account_cancel valid": { success: true },
      "post /wsapi/account_cancel invalid": { success: false },
      "post /wsapi/account_cancel ajaxError": undefined,
      "post /wsapi/stage_email valid": { success: true },
      "post /wsapi/stage_email unknown_secondary": { success: true },
      "post /wsapi/stage_email known_secondary": { success: true },
      "post /wsapi/stage_email invalid": { success: false },
      "post /wsapi/stage_email throttle": 429,
      "post /wsapi/stage_email ajaxError": undefined,
      "get /wsapi/email_addition_status?email=testuser%40testuser.com complete": { status: "complete" },
      "get /wsapi/email_addition_status?email=registered%40testuser.com pending": { status: "pending" },
      "get /wsapi/email_addition_status?email=registered%40testuser.com complete": { status: "complete" },
      "get /wsapi/email_addition_status?email=registered%40testuser.com mustAuth": { status: "mustAuth" },
      "get /wsapi/email_addition_status?email=registered%40testuser.com noRegistration": { status: "noRegistration" },
      "get /wsapi/email_addition_status?email=registered%40testuser.com ajaxError": undefined,
      "get /wsapi/list_emails valid": { success: true, emails: [ "testuser@testuser.com" ] },
      "get /wsapi/list_emails primaryTransition": { success: true, emails: [ "testuser@testuser.com" ] },
      "get /wsapi/list_emails secondaryTransition": { success: true, emails: [ "testuser@testuser.com" ] },
      "get /wsapi/list_emails secondaryTransitionPassword": { success: true, emails: [ "testuser@testuser.com" ] },
      "get /wsapi/list_emails foreverSession": { success: true, emails: [ "testuser@testuser.com" ] },
      "get /wsapi/list_emails unverified": { success: true, emails: [ "testuser@testuser.com" ] },
      //"get /wsapi/list_emails known_secondary": {"registered@testuser.com":{ type: "secondary" }},
      "get /wsapi/list_emails primary": { success: true, emails: [ "testuser@testuser.com" ] },
      "get /wsapi/list_emails multiple": { success: true, emails: [ "testuser@testuser.com", "testuser2@testuser.com" ] },
      "get /wsapi/list_emails no_identities": { success: true, emails: [] },
      "get /wsapi/list_emails invalid": undefined,
      "get /wsapi/list_emails ajaxError": undefined,
      // Used in conjunction with registration to do a complete userflow
      "get /wsapi/list_emails complete": { success: true, emails: [ "registered@testuser.com", "synced_address@testuser.com" ] },
      "post /wsapi/set_password valid": { success: true },
      "post /wsapi/set_password invalid": { success: false },
      "post /wsapi/set_password ajaxError": undefined,
      "post /wsapi/update_password valid": { success: true },
      "post /wsapi/update_password incorrectPassword": { success: false },
      "post /wsapi/update_password invalid": undefined,

      "get /wsapi/address_info?email=unregistered%40testuser.com&issuer=default invalid": undefined,
      "get /wsapi/address_info?email=unregistered%40testuser.com&issuer=default throttle": { type: "secondary", state: "unknown" },
      "get /wsapi/address_info?email=unregistered%40testuser.com&issuer=default valid": { type: "secondary", state: "unknown" },
      "get /wsapi/address_info?email=UNREGISTERED%40TESTUSER.COM&issuer=default valid": { type: "secondary", state: "unknown", normalizedEmail: "unregistered@testuser.com" },
      "get /wsapi/address_info?email=unregistered%40testuser.com&issuer=default unknown_secondary": { type: "secondary", state: "unknown" },
      "get /wsapi/address_info?email=unregistered%40testuser.com&issuer=default primary": { type: "primary", state: "unknown", auth: "https://auth_url", prov: "https://prov_url" },
      "get /wsapi/address_info?email=unregistered%40testuser.com&issuer=default primaryUnknown": { type: "primary", state: "unknown", auth: "https://auth_url", prov: "https://prov_url" },
      "get /wsapi/address_info?email=unregistered%40testuser.com&issuer=fxos_issuer unknown_secondary": { type: "secondary", state: "unknown" },

      "get /wsapi/address_info?email=registered%40testuser.com&issuer=default valid": { type: "secondary", state: "known", normalizedEmail: "registered@testuser.com" },
      "get /wsapi/address_info?email=testuser%40testuser.com&issuer=default unverified": { type: "secondary", state: "unverified" },
      "get /wsapi/address_info?email=registered%40testuser.com&issuer=default unverified": { type: "secondary", state: "unverified" },
      "get /wsapi/address_info?email=REGISTERED%40TESTUSER.COM&issuer=default valid": { type: "secondary", state: "known", normalizedEmail: "registered@testuser.com" },
      "get /wsapi/address_info?email=registered%40testuser.com&issuer=default known_secondary": { type: "secondary", state: "known", normalizedEmail: "registered@testuser.com" },
      "get /wsapi/address_info?email=registered%40testuser.com&issuer=default throttle": { type: "secondary", state: "known", normalizedEmail: "registered@testuser.com" },
      "get /wsapi/address_info?email=registered%40testuser.com&issuer=default primary": { type: "primary", state: "known", auth: "https://auth_url", prov: "https://prov_url", normalizedEmail: "registered@testuser.com" },
      "get /wsapi/address_info?email=registered%40testuser.com&issuer=default mustAuth": { type: "secondary", state: "known", normalizedEmail: "registered@testuser.com" },
      "get /wsapi/address_info?email=testuser%40testuser.com&issuer=default secondaryTransition": { type: "secondary", state: "transition_to_secondary", normalizedEmail: "testuser@testuser.com" },
      "get /wsapi/address_info?email=registered%40testuser.com&issuer=default secondaryTransition": { type: "secondary", state: "transition_to_secondary", normalizedEmail: "registered@testuser.com" },
      "get /wsapi/address_info?email=REGISTERED%40TESTUSER.COM&issuer=default secondaryTransition": { type: "secondary", state: "transition_to_secondary", normalizedEmail: "registered@testuser.com" },
      "get /wsapi/address_info?email=registered%40testuser.com&issuer=default secondaryTransitionPassword": { type: "secondary", state: "transition_no_password", normalizedEmail: "registered@testuser.com" },
      "get /wsapi/address_info?email=REGISTERED%40TESTUSER.COM&issuer=default secondaryTransitionPassword": { type: "secondary", state: "transition_no_password", normalizedEmail: "registered@testuser.com" },
      "get /wsapi/address_info?email=registered%40testuser.com&issuer=default primaryTransition": { type: "primary", state: "transition_to_primary", auth: "https://auth_url", prov: "https://prov_url", normalizedEmail: "registered@testuser.com" },
      "get /wsapi/address_info?email=testuser%40testuser.com&issuer=default primaryTransition": { type: "primary", state: "transition_to_primary", auth: "https://auth_url", prov: "https://prov_url", normalizedEmail: "testuser@testuser.com" },
      "get /wsapi/address_info?email=registered%40testuser.com&issuer=default primaryOffline": { type: "primary", state: "offline", auth: "https://auth_url", prov: "https://prov_url", normalizedEmail: "registered@testuser.com" },

      "get /wsapi/address_info?email=testuser%40testuser.com&issuer=fxos_issuer valid": { type: "secondary", state: "known", normalizedEmail: "testuser@testuser.com" },
      "get /wsapi/address_info?email=testuser%40testuser.com&issuer=default valid": { type: "secondary", state: "known", normalizedEmail: "testuser@testuser.com" },
      "get /wsapi/address_info?email=testuser2%40testuser.com&issuer=default valid": { type: "secondary", state: "known", normalizedEmail: "testuser@testuser.com" },
      "get /wsapi/address_info?email=testuser%40testuser.com&issuer=default known_secondary": { type: "secondary", state: "known", normalizedEmail: "testuser@testuser.com" },

      "get /wsapi/address_info?email=testuser%40testuser.com&issuer=default unknown_secondary": { type: "secondary", state: "unknown" },
      "get /wsapi/address_info?email=testuser%40testuser.com&issuer=default secondaryTransitionPassword": { type: "secondary", state: "transition_no_password", normalizedEmail: "testuser@testuser.com" },
      "get /wsapi/address_info?email=testuser%40testuser.com&issuer=default primary": { type: "primary", state: "known", auth: "https://auth_url", prov: "https://prov_url", normalizedEmail: "testuser@testuser.com" },
      "get /wsapi/address_info?email=testuser%40testuser.com&issuer=default primaryOffline": { type: "primary", state: "offline", auth: "https://auth_url", prov: "https://prov_url", normalizedEmail: "testuser@testuser.com" },
      "get /wsapi/address_info?email=testuser%40testuser.com&issuer=default ajaxError": undefined,

      "post /wsapi/used_address_as_primary valid": { success: true },
      "post /wsapi/used_address_as_primary primaryTransition": { success: true },
      "post /wsapi/used_address_as_primary primaryUnknown": { success: true },
      "post /wsapi/used_address_as_primary primary": { success: false },
      "post /wsapi/add_email_with_assertion invalid": { success: false },
      "post /wsapi/add_email_with_assertion valid": { success: true },
      "post /wsapi/prolong_session valid": { success: true },
      "post /wsapi/prolong_session unauthenticated": 400,
      "post /wsapi/prolong_session ajaxError": undefined,
      "post /wsapi/interaction_data valid": { success: true },
      "post /wsapi/interaction_data throttle": 413,
      "post /wsapi/interaction_data ajaxError": undefined,
      // request used to test the abortAll functionality of xhr.js
      "get /slow_request valid": function(xhrObj) {
        xhrObj._delayTimeout = setTimeout(function() {
          if (xhrObj._request.success) {
            xhrObj._request.success({ success: true });
          }
        }, 1000);
      }
    },

    setContextInfo: function(field, value) {
      contextInfo[field] = value;
    },

    setDelay: function(delay_ms) {
      delay = delay_ms;
    },

    useResult: function(result) {
      xhr.responseName = result;
    },

    getLastRequest: function(key) {
      var req = this.request;
      if (key) {
        req = this.requests[key];
      }

      return req;
    },

    ajax: function(request) {
      //console.log("ajax request");
      var type = request.type ? request.type.toLowerCase() : "get";


      var xhrObj = {
        "_request": request,
        "_response": response,
        abort: function() {
          if (this._delayTimeout) {
            clearTimeout(this._delayTimeout);
            this._delayTimeout = null;
            delete this._delayTimeout;
          }

          if (this._request.error) {
            xhrObj.statusText = "aborted";
            this._request.error(xhrObj, 0, "");
          }
        }
      };

      this.request = request = _.extend(request, {
        type: type
      });

      if (type === "post" && request.data.indexOf("csrf") === -1) {
        ok(false, "missing csrf token on POST request");
      }

      var responseName = xhr.responseName;

      // Unless the contextAjaxError is specified, use the "valid" context info.
      // This makes it so we do not have to keep adding new items for
      // context_info for every possible result type.
      if (request.url === "/wsapi/session_context" && responseName !== "contextAjaxError") {
        responseName = "valid";
      }

      var responseKey = request.type + " " + request.url + " " + responseName,
          response = xhr.responses[responseKey],
          typeofResponse = typeof response;
      // Unit tests busted with no feedback? Un-comment this bad boy and look for 'typeofResponse=undefined'
      // Pull Request #2760 will automate this...
      //console.log('responseKey=' + responseKey + ' response=' + response + ' typeofResponse=' + typeofResponse);

      this.requests[request.url] = request;

      if (!(responseKey in xhr.responses) && responseName !== "ajaxError") {
        console.error("request for '" + responseKey + "' is not mocked in resources/static/test/cases/xhr.js");
      }

      if (typeofResponse === "function") {
        response(xhrObj);
      }
      else if (!(typeofResponse === "number" || typeofResponse === "undefined")) {
        if (typeofResponse === "object") {
          response = _.extend({}, response);
        }

        if (request.success) {
          if (delay) {
            // simulate response delay
            _.delay(request.success, delay, response);
          }
          else {
            request.success(response);
          }
        }
      }
      else if (request.error) {
        // Invalid response - either invalid URL, invalid GET/POST or
        // invalid responseName
        xhrObj.status = response || "errorStatus";
        xhrObj.responseText = "response text";
        request.error(xhrObj, xhrObj.status, "errorThrown");
      }

      return xhrObj;
    }
  };

  return xhr;
}());


