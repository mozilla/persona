/*globals BrowserIDNetwork: true, BrowserIDIdentities: true, _: true, confirm: true, display_saved_ids: true*/
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

$(function() {
  "use strict";

  /**
   * For the main page
   */

  if ($('#vAlign').length) {
    $(window).bind('resize', function() { $('#vAlign').css({'height' : $(window).height() }); }).trigger('resize');
  }

  $(".signOut").click(function(event) {
    event.preventDefault();

    BrowserIDIdentities.logoutUser(function() {
      document.location = "/";
    });
  });

  BrowserIDIdentities.checkAuthentication(function(authenticated) {
    if (authenticated) {
      $("#content").fadeIn("slow");
      if ($('#emailList').length) {
        display_saved_ids();
      }
    }
    else {
      // If vAlign exists (main page), it takes precedence over content.
      if( $("#vAlign").length) {
        $("#vAlign").fadeIn("slow");
      }
      else {
        $("#content").fadeIn("slow");
      }
    }
  });

  _.mixin({
    relative: function(date) {
      var diff = (((new Date()).getTime() - date.getTime()) / 1000),
          day_diff = Math.floor(diff / 86400),
          dObj = { "friendly" : date.toLocaleDateString(),
                  "additional" : date.toLocaleTimeString(),
                  "utc" : date.toUTCString(),
                  "locale" : date.toLocaleString() };

      /* some kind of error */
      if (day_diff < 0) {
          dObj.friendly = "in the future!?!";
          return dObj;
      } else if (isNaN(day_diff)) {
          dObj.friendly = dObj.additional = "unknown";
          return dObj;
      }

      if (day_diff === 0) {
          if (diff < 60) {
              dObj.friendly = "just now";
              return dObj;
          }
          if (diff < 120 + 30) { /* 1 minute plus some fuzz */
              dObj.friendly = "a minute ago";
              return dObj;
          }
          if (diff < 3600) {
              dObj.friendly = Math.floor(diff / 60) + " minutes ago";
              return dObj;
          }
          if (diff < (60 * 60) * 2) {
              dObj.friendly = "1 hour ago";
              return dObj;
          }
          if (diff < 24 * 60 * 60) {
              dObj.friendly = Math.floor(diff / 3600) + " hours ago";
              return dObj;
          }
      }
      if (day_diff === 1) {
          dObj.friendly = "yesterday";
          return dObj;
      }
      if (day_diff < 7) {
          dObj.friendly = day_diff + " days ago";
          return dObj;
      }
      if (day_diff < 8) {
          dObj.friendly = "last week";
          return dObj;
      }
      /* for this scope: we want day of week and the date
           plus the month (if different) */
      if (day_diff < 31) {
          dObj.friendly = Math.ceil(day_diff / 7) + " weeks ago";
          return dObj;
      }

      /* for this scope: we want month + date */
      if (day_diff < 62) {
          dObj.friendly = "a month ago";
          return dObj;
      }
      if (day_diff < 365) {
          dObj.friendly = Math.ceil(day_diff / 31) + " months ago";
          return dObj;
      }

      /* for this scope: we want month + year */
      if (day_diff >= 365 && day_diff < 730) {
          dObj.additional = date.toLocaleDateString();
          dObj.friendly = "a year ago";
          return dObj;
      }
      if (day_diff >= 365) {
          dObj.additional = date.toLocaleDateString();
          dObj.friendly = Math.ceil(day_diff / 365) + " years ago";
          return dObj;
      }
      return dObj;
    }
  });


  function display_saved_ids() {
    var emails = {};

    BrowserIDIdentities.syncEmailKeypairs(function() {
      emails = BrowserIDIdentities.getStoredEmailKeypairs();
      if (_.isEmpty(emails)) {
        console.log(emails);
        $("#content").hide();
      } else {
        $("#content").show();
        $("#vAlign").hide();
        displayEmails();
      }
    });

    function displayEmails() {
      // XXX: this is currently not displayed
      $('#cancellink').click(function() {
        if (confirm('Are you sure you want to cancel your account?')) {
          BrowserIDNetwork.cancelUser(function() {
            document.location="/";
          });
        }
      });

      $('#manageAccounts').click(function(event) {
          event.preventDefault();

          $('#emailList').addClass('remove');
          $(this).hide();
          $("#cancelManage").show();
      });
      
      $('#cancelManage').click(function(event) {
          event.preventDefault();

          $('#emailList').removeClass('remove');
          $(this).hide();
          $("#manageAccounts").show();
      });

      var list = $("#emailList").empty();

      // Set up to use mustache style templating, the normal Django style blows 
      // up the node templates
      _.templateSettings = {
          interpolate : /\{\{(.+?)\}\}/g
      };
      var template = $('#templateUser').html();

      _(emails).each(function(data, e) {
        var date = _.relative(new Date(data.created));

        var identity = _.template(template, {
          email: e,
          relative: date.friendly,
          created: date.locale
        });

        var idEl = $(identity).appendTo(list);
        idEl.find('.delete').click(onRemoveEmail.bind(null, e));
      });

      function onRemoveEmail(email, event) {
        event.preventDefault();

        if (confirm("Remove " + email + " from your BrowserID?")) {
          BrowserIDIdentities.removeEmail(email, display_saved_ids);
        }
      }
    }
  }


  /**
   * For the prove page
   */
  function getParameterByName( name ) {
    name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
    var regexS = "[\\?&]"+name+"=([^&#]*)";
    var regex = new RegExp( regexS );
    var results = regex.exec( window.location.href );
    if( results == null )
      return "";
    else
      return decodeURIComponent(results[1].replace(/\+/g, " "));
  }

  function emailRegistrationSuccess() {
    $("div.status").text("Address confirmed!");
    $("body").delay(1000).fadeOut(500, function() {
      // if the close didn't work, then let's redirect the the main page where they'll
      // get to see the ids that they've created.
      document.location = '/';
    });
  }

  function emailRegistrationFailure(why) {
    $("div.status").text("Error encountered while attempting to confirm your address.  Have you previously verified this address?");
  }

  var token = getParameterByName("token"),
      path = document.location.pathname;

  if (token && path === "/prove") {
    BrowserIDNetwork.completeEmailRegistration(token, function onSuccess(valid) {
        if (valid) {
          emailRegistrationSuccess();
        } else {
          emailRegistrationFailure("unknown");
        }

    }, function onFailure() {
        failure("Error Communicating With Server!");
    });
  }


  if(token && path === "/verify") {
    $("#signUpForm").submit(function(event) {
      event.preventDefault();

      var email = $("#email").val(),
          pass = $("#password").val(),
          pass2 = $("#vpassword").val();

      if (pass && pass === pass2) {
        BrowserIDNetwork.completeUserRegistration(token, pass, function onSuccess(registered) {
          if (registered) {
            $("#congrats").fadeIn(250);
          }
        }, function onFailure() {

        });
      }
    });
  }
});

