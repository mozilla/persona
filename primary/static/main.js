// this is the picker code!  it runs in the identity provider's domain, and
// fiddles the dom expressed by picker.html
(function() {

  function refreshAuthStatus() {
    $.ajax({
      url: '/wsapi/current_username',
      success: function(status, textStatus, jqXHR) {
        console.log(status);
        console.log("textStatus is " + jqXHR.responseText);
        var currentUsername = JSON.parse(jqXHR.responseText);
        console.log("parsed as " + currentUsername);
        if (!currentUsername) {
          $("#logged_out").show();
        } else {
          $("#username").text(currentUsername);
          $("#logged_in").show();
        }
      },
      error: function() {
        runErrorDialog(
          "serverError",
          "Error Communicating With Server!",
          "There was a technical problem while trying to log you in.  Yucky!");
      }
    });
  }
  
  function runErrorDialog(code, title, message, onsuccess, onerror) {
    $(".dialog").hide();

    $("#error_dialog div.title").text(title);
    $("#error_dialog div.content").text(message);

    $("#back").hide();
    $("#cancel").hide();
    $("#submit").show().unbind('click').click(function() {
      onerror(code);
    }).text("Close");

    $("#error_dialog").fadeIn(500);
  }
  
  function runConfirmationDialog(username) {
    refreshAuthStatus();
    $("#welcome_address").text(username + "@primary.mozilla.org");
    $("#welcome_dialog").fadeIn(500);
    $("#create_welcome").show().unbind('click').click(function() {
      $("#welcome_dialog").fadeOut(500);    
    });
  };

  function runCreateDialog() {
    $(".dialog").hide();

    $("#back").show().unbind('click').click(function() {
      runAuthenticateDialog(undefined);
    });
    $("#create_cancel").show().unbind('click').click(function() {
      onerror("canceled");
    });
    $("#create_submit").show().unbind('click').click(function() {
      // ignore the click if we're disabled
      if ($(this).hasClass('disabled')) return true;

      // now we need to actually try to stage the creation of this account.
      var username = $("#create_dialog input:eq(0)").val();
      var pass = $("#create_dialog input:eq(1)").val();

      // Go do it...
      $.ajax({
        url: '/wsapi/create_user?username=' + encodeURIComponent(username) + '&pass=' + encodeURIComponent(pass),
        success: function(result) {        
          $(".dialog").hide();
          if (result) {
            runConfirmationDialog(username);
            try {
              
              navigator.id.registerVerifiedEmail(username + "@primary.mozilla.org", function(publicKey) {
                $.ajax({
                  url: '/wsapi/add_key?pubkey=' + encodeURIComponent(publicKey),
                  success: function() {
                    // key is saved - we're done?
                  },
                  error: function() {
                  }});
              }, function(error) {
                runErrorDialog(
                  "serverError",
                  "Error Registering Address!",
                  "There was a technical problem while trying to register your address.  Sorry.");
              
              });
            } catch (e) {
              alert("Whoops, unable to register verified email: " + e);
            }
          } else {
            runErrorDialog(
              "serverError",
              "Error Creating Account!",
              "There was a technical problem while trying to create your account.  Sorry.");
          }
        },
        error: function() {
          runErrorDialog(
            "serverError",
            "Error Creating Account!",
            "There was a technical problem while trying to create your account.  Yucky.");
        }
      });
    }).text("Continue").addClass("disabled");

    $("#create_dialog div.attention_lame").hide();
    $("#create_dialog div.attention_lame a").unbind('click').click(function() {
      var username = $("#create_dialog input:eq(0)").val();
      runAuthenticateDialog(username);
    });

    function checkInput() {
      $("#create_submit").removeClass("disabled");

      // check the username
      var email = $("#create_dialog input:eq(0)").val();
      $("#create_dialog div.note:eq(0)").empty();
      if (typeof email === 'string' && email.length) {

        var valid = checkedEmails[email];
        if (typeof valid === 'string') {
          // oh noes.  we tried to check this email, but it failed.  let's just not tell the
          // user anything, cause this is a non-critical issue

        } else if (typeof valid === 'boolean') {
          if (valid) {
            $("#create_dialog div.note:eq(0)").html($('<span class="good"/>').text("Username available!"));
            $("#create_dialog div.attention_lame").hide();
          } else {
            $("#create_dialog div.attention_lame").fadeIn(300);
            $("#create_dialog div.attention_lame span.email").text(email);
            $("#create_submit").addClass("disabled");
          }
        } else {
          // this is an email that needs to be checked!
          if (emailCheckState !== 'querying') {
            if (emailCheckState) window.clearTimeout(emailCheckState);
            emailCheckState = setTimeout(function() {
              emailCheckState = 'querying';
              var checkingNow = nextEmailToCheck;
              // bounce off the server and enter the 'querying' state
              $.ajax({
                url: '/wsapi/username_available?username=' + encodeURIComponent(checkingNow),
                success: function(data, textStatus, jqXHR) {
                  checkedEmails[checkingNow] = !JSON.parse(data);
                  emailCheckState = undefined;
                  checkInput();
                }, error: function(jqXHR, textStatus, errorThrown) {
                  // some kind of error was encountered.  This is non-critical, we'll simply ignore it
                  // and mark this email check as failed.
                  checkedEmails[checkingNow] = "server failed";
                  emailCheckState = undefined;
                  checkInput();
                }
              });
            }, 700);
          } else {
            $("#create_dialog div.note:eq(0)").html($('<span class="warning"/>').text("Checking address"));
          }
          nextEmailToCheck = email;
          $("#create_submit").addClass("disabled");
        }
      } else {
        $("#create_submit").addClass("disabled");
      }

      // next let's check the password entry
      var pass = $("#create_dialog input:eq(1)").val();
      var match = pass === $("#create_dialog input:eq(2)").val();
      if (!match) {
        $("#create_submit").addClass("disabled");
        $("#create_dialog div.note:eq(1)").html($('<span class="bad"/>').text("Passwords different"));
      } else {
        if (!pass) {
          $("#create_submit").addClass("disabled");
          $("#create_dialog div.note:eq(1)").html($('<span class="bad"/>').text("Enter a password"));
        } else if (pass.length < 5) {
          $("#create_submit").addClass("disabled");
          $("#create_dialog div.note:eq(1)").html($('<span class="bad"/>').text("Password too short"));
        } else {
          $("#create_dialog div.note:eq(1)").html($('<span class="good"/>').text("Password OK"))
        }
      }
    }

    // watch input dialogs
    $("#create_dialog input").unbind('keyup').bind('keyup', checkInput);

    // do a check at load time, in case the user is using the back button (enables the continue button!)
    checkInput();

    $("#create_dialog").fadeIn(500);
  } // end runCreateDialog

  // a handle to a timeout of a running email check
  var emailCheckState = undefined;
  // the next email to check, if one is entered while a check is running
  var nextEmailToCheck = undefined;
  // a set of emails that we've checked for this session
  var checkedEmails = {
  };

  

  function runAuthenticateDialog(email, onsuccess, onerror) {
    $(".status").hide();

    $(".dialog").hide();
    $("#back").hide();
    $("#cancel").show().unbind('click').click(function() {
      onerror("canceled");
    });
    $("#signin_submit").show().unbind('click').click(function() {
      if ($(this).hasClass('disabled')) return true;

      var email = $("#authenticate_dialog input:eq(0)").val();
      var pass = $("#authenticate_dialog input:eq(1)").val();

      $.ajax({
        url: '/wsapi/authenticate_user?email=' + encodeURIComponent(email) + '&pass=' + encodeURIComponent(pass),
        success: function(status, textStatus, jqXHR) {
          var authenticated = JSON.parse(status);
          if (!authenticated) {
            $("#authenticate_dialog div.attention_lame").hide().fadeIn(400);
          } else {
            runWaitingDialog(
              "Finishing Log In...",
              "In just a moment you'll be logged into BrowserID.",
              onsuccess, onerror);

            syncIdentities(onsuccess, onerror);
          }
        },
        error: function() {
          runErrorDialog(
            "serverError",
            "Error Authenticating!",
            "There was a technical problem while trying to log you in.  Yucky!",
            onsuccess, onerror);
        }
      });
    }).text("Sign In").addClass("disabled");;

    // preseed the email input if whoever triggered us told us to
    if (email) {
      $("#authenticate_dialog input:eq(0)").val(email);
    }

    $("#authenticate_dialog div.note > a").unbind('click').click(function() {
      onerror("notImplemented");
    });
    $("#authenticate_dialog div.actions div.action").unbind('click').click(function() {
      runCreateDialog(onsuccess, onerror);
    });

    $("#authenticate_dialog div.attention_lame").hide();

    $("#authenticate_dialog input").unbind('keyup').bind('keyup', function() {
      var email = $("#authenticate_dialog input:eq(0)").val();
      var pass = $("#authenticate_dialog input:eq(1)").val();
      if (email.length > 0 && pass.length > 0) $("#signin_submit").removeClass('disabled');
      else $("#signin_submit").addClass('disabled');
    });
    $("#authenticate_dialog .bottom-bar button").hide();
    $("#authenticate_dialog").fadeIn(
      500,
      function() {
        // where should we put the focus?  On login if empty, else password
        var email = $("#authenticate_dialog input:eq(0)").val();
        if (typeof email === 'string' && email.length) {
          $("#authenticate_dialog input:eq(1)").focus();
        } else {
          $("#authenticate_dialog input:eq(0)").focus();
        }
      });
  }

  function runErrorDialog(code, title, message) {
    $(".dialog").hide();

    $("#error_dialog div.title").text(title);
    $("#error_dialog div.content").text(message);

    $("#error_submit").show().unbind('click').click(function() {
      $("#error_dialog").fadeOut(500);
    }).text("Close");

    $("#error_dialog").fadeIn(500);
  }



  // Set up initial bindings
  $("#sign_in").click(function() {
    runAuthenticateDialog(undefined);
  });
  
  $("#sign_out").click(function() {
    $.ajax({
      url: '/wsapi/signout',
      success: function(status, textStatus, jqXHR) {
        $("logged_in").hide();
        $("logged_out").show();
      },
      error: function() {
        runErrorDialog(
          "serverError",
          "Error Communicating With Server!",
          "There was a technical problem while trying to log you out.  Sorry!",
          onsuccess, onerror);
      }
    });
  });
  
  refreshAuthStatus();

/*  // 'Enter' in any input field triggers a click on the submit button
  $('input').keypress(function(e){
    if(e.which == 13) {
      $('#submit').click();
      e.preventDefault();
    }
  });
  */      
})();
