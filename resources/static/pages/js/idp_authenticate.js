// In the style of pages/js/start.js
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

$(function() {
  "use strict";

  /**
   * For the main page
   */
/*
  var bid = BrowserID,
      helpers = bid.Helpers,
      pageHelpers = bid.PageHelpers,
      user = bid.User,
      dom = bid.DOM,
      network = bid.Network,
      token = pageHelpers.getParameterByName("token"),
      path = document.location.pathname || "/",
      moduleManager = bid.module,
      modules = bid.Modules,
      CookieCheck = modules.CookieCheck,
      XHRDelay = modules.XHRDelay,
      XHRDisableForm = modules.XHRDisableForm,
      Development = modules.Development,
      ANIMATION_TIME = 500,
      checkCookiePaths = [ "/add_email_address", "/confirm", "/verify_email_address" ];
  function start(status) {
    // If cookies are disabled, do not run any of the page specific code and
    // instead just show the error message.
    if (!status) return;

  }
*/
});


// authentication_form add returning
// or #signin .contents
$('#authentication_form').addClass('returning');
$('.isMobile').removeClass('isMobile');
$('#authentication_form').show();
var csrf_token;
$('button.isReturning').click(function(e) {
  e.preventDefault();
  $('#cannot_authenticate').hide('fast');
  var params = {
    "email": $('#authentication_email').val(),
    "pass": $('#authentication_password').val(),
    "ephemeral":true,
    "allowUnverified": false,
    "csrf": csrf_token
  };
  console.log('Sending ', params);
  $.ajax('/wsapi/authenticate_user', {
    type: 'POST',
    contentType: 'application/json; charset=UTF-8',
    data: JSON.stringify(params),
    dataType: 'json',
    error: function(xhr, status, err) {
      $('#cannot_authenticate').show('fast');
      console.error('Auth call failed');
      console.log(xhr, status, err);
      console.error(err);
    },
    success: function(res, status, xhr) {
      console.log('res data=', typeof res, res, typeof res.success);
      if (res.success === true ||
          res.success === "true") {
        navigator.id.completeAuthentication();
      }
    },
    complete: function(tbd) {
      console.log('/wsapi/authenticate_user finished');
    }
  });
});

$('.cancelPassword:visible').click(function(e) {
  e.preventDefault();
  var msg = "user clicked cancel";
  navigator.id.raiseProvisioningFailure(msg);
});

console.log('Starting beginAuthentication');
navigator.id.beginAuthentication(function(email) {
  $('#authentication_email').val(email);
  $('#authentication_email').attr('disabled', 'disabled');
  console.log('callback beginAuthentication');
  console.log(email);
  $.getJSON('/wsapi/session_context', function(data, status, xhr) {
    console.log(data);
    csrf_token = data.csrf_token;
    console.log('csrf_token=', csrf_token);
    if (data.authenticated) {
      $.getJSON('/wsapi/list_emails', function(data, status, xhr) {
        console.log('list_emails', data);
        if (data.emails.indexOf(email) !== -1) {
          console.log('Woo hoo you all clear kid');
          navigator.id.completeAuthentication();
        }
      });
    }
  });
});
