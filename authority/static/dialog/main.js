// this is the picker code!  it runs in the identity provider's domain, and
// fiddles the dom expressed by picker.html
(function() {
  var chan = Channel.build(
    {
      window: window.opener,
      origin: "*",
      scope: "mozid"
    });

  var remoteOrigin = undefined;

  function runSignInDialog(onsuccess, onerror) {
    $(".dialog").hide();

    $("#back").hide();
    $("#cancel").show().unbind('click').click(function() {
      onerror("canceled");
    });
    $("#submit").show().unbind('click').click(function() {
      var email = $("#identities input:checked").parent().find("div").text();
      // yay!  now we need to produce an assertion.
      var privkey = JSON.parse(window.localStorage.emails)[email].priv;
      var assertion = CryptoStubs.createAssertion(remoteOrigin, email, privkey);
      onsuccess(assertion);
    }).text("Sign In");

    $("#default_dialog div.actions div.action a").unbind('click').click(function() {
      onerror("notImplemented");
    });

    // now populate the selection list with all available emails
    // we assume there are identities available, because without them 
    var emails = JSON.parse(window.localStorage.emails);
    var first = true; 
    for (var k in emails) {
      var id = $("<div />")
        .append($("<input />").attr('type', 'radio').attr('name', 'identity').attr('checked', first))
        .append($("<div />").text(k));
      first = false;
      id.appendTo($("form#identities"));
    }

    $("#sign_in_dialog").fadeIn(500);
  }

  function runAuthenticateDialog(onsuccess, onerror) {
    $(".dialog").hide();

    $("#back").hide();
    $("#cancel").show().unbind('click').click(function() {
      onerror("canceled");
    });
    $("#submit").show().unbind('click').click(function() {
      onerror("notImplemented");
    }).text("Sign In");
    $("#authenticate_dialog div.note > a").unbind('click').click(function() {
      onerror("notImplemented");
    });
    $("#authenticate_dialog div.actions div.action").unbind('click').click(function() {
      runCreateDialog(onsuccess, onerror);
    });
    $("#authenticate_dialog").fadeIn(500);
  }

  // a handle to a timeout of a running email check
  var emailCheckState = undefined;
  // the next email to check, if one is entered while a check is running
  var nextEmailToCheck = undefined;
  // a set of emails that we've checked for this session
  var checkedEmails = {
  };

  function runConfirmEmailDialog(email, keypair, onsuccess, onerror) {
    $(".dialog").hide();

    $("span.email").text(email);

    // now poll every 3s waiting for the user to complete confirmation
    function setupRegCheck() {
      return setTimeout(function() {
        $.ajax({
          url: '/wsapi/registration_status',
          success: function(status, textStatus, jqXHR) {
            // registration status checks the status of the last initiated registration,
            // it's possible return values are:
            //   'complete' - registration has been completed
            //   'pending'  - a registration is in progress
            //   'noRegistration' - no registration is in progress  
            if (status === 'complete') {
              // now we need to add all of the pertinent data to local storage
              var emails = {};
              if (window.localStorage.emails) emails = JSON.parse(window.localStorage.emails);
              emails[email] = keypair;
              window.localStorage.emails = JSON.stringify(emails);

              // and tell the user that everything is really quite awesome.
              runConfirmedEmailDialog(email, onsuccess, onerror);
            } else if (status === 'pending') {
              // try again, what else can we do?
              pollTimeout = setupRegCheck();              
            } else {
              runErrorDialog(
                "serverError",
                "Registration Failed",
                "An error was encountered and the sign up cannot be completed, please try again later.",
                onsuccess,
                onerror);
            }
          },
          error: function(jqXHR, textStatus, errorThrown) {
            runErrorDialog("serverError", "Registration Failed", jqXHR.responseText, onsuccess, onerror);
          }
        });
      }, 3000);
    }

    var pollTimeout = setupRegCheck();

    $("#back").show().unbind('click').click(function() {
      window.clearTimeout(pollTimeout);
      runCreateDialog(onsuccess, onerror);
    });

    $("#cancel").show().unbind('click').click(function() {
      window.clearTimeout(pollTimeout);
      onerror("canceled");
    });
    $("#submit").hide();

    $("#create_email_dialog div.actions div.action a").unbind('click').click(function() {
      // XXX: resend the email!
      return true;
    });
    $("#confirm_email_dialog").fadeIn(500);

  }

  function runConfirmedEmailDialog(email, onsuccess, onerror) {
    $(".dialog").hide();

    $("span.email").text(email);

    $("#back").hide();

    $("#cancel").show().unbind('click').click(function() {
      onerror("canceled");
    });
    $("#submit").show().unbind('click').click(function() {
      runSignInDialog(onsuccess, onerror);
    }).text("Continue");

    $("#confirmed_email_dialog").show();
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

  function runWaitingDialog(title, message, onsuccess, onerror) {
    $(".dialog").hide();

    $("#waiting_dialog div.title").text(title);
    $("#waiting_dialog div.content").text(message);

    $("#back").hide();
    $("#submit").hide();
    $("#cancel").show().unbind('click').click(function() {
      onerror("canceled");
    });

    $("#waiting_dialog").fadeIn(500);
  }

  function runCreateDialog(onsuccess, onerror) {
    $(".dialog").hide();

    $("#back").show().unbind('click').click(function() {
      runAuthenticateDialog(onsuccess, onerror);
    });
    $("#cancel").show().unbind('click').click(function() {
      onerror("canceled");
    });
    $("#submit").show().unbind('click').click(function() {
      // ignore the click if we're disabled
      if ($(this).hasClass('disabled')) return true;

      // now we need to actually try to stage the creation of this account.
      var email = $("#create_dialog input:eq(0)").val();
      var pass = $("#create_dialog input:eq(1)").val();
      var keypair = CryptoStubs.genKeyPair();

      // kick the user to waiting/status page while we talk to the server.
      runWaitingDialog(
        "One Moment Please...",
        "We're creating your account, this should only take a couple seconds",
        onsuccess,
        onerror
      );

      $.ajax({
        url: '/wsapi/stage_user?email=' + encodeURIComponent(email) + '&pass=' + encodeURIComponent(pass) + '&pubkey=' + encodeURIComponent(keypair.pub),
        success: function() {
          // account successfully staged, now wait for email confirmation
          runConfirmEmailDialog(email, keypair, onsuccess, onerror);
        },
        error: function() {
          runErrorDialog(
            "serverError",
            "Error Creating Account!",
            "There was a technical problem while trying to create your account.  Yucky.",
            onsuccess, onerror);
        }
      });
    }).text("Continue").addClass("disabled");


    function checkInput() {
      $("#submit").removeClass("disabled");

      // check the email address
      var email = $("#create_dialog input:eq(0)").val();
      $("#create_dialog div.note:eq(0)").empty();
      if (typeof email === 'string' && email.length) {
        var valid = checkedEmails[email];
        if (typeof valid === 'string') {
          // oh noes.  we tried to check this email, but it failed.  let's just not tell the
          // user anything, cause this is a non-critical issue

        } else if (typeof valid === 'boolean') {
          if (valid) {
            $("#create_dialog div.note:eq(0)").html($('<span class="good"/>').text("Not registered"));
          } else {
            $("#create_dialog div.note:eq(0)").html($('<span class="bad"/>').text("Email in use"));
            $("#submit").addClass("disabled");
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
                url: '/wsapi/have_email?email=' + encodeURIComponent(checkingNow),
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
          $("#submit").addClass("disabled");
        }
      } else {
        $("#submit").addClass("disabled");
      }

      // next let's check the password entry
      var pass = $("#create_dialog input:eq(1)").val();
      var match = pass === $("#create_dialog input:eq(2)").val();
      if (!match) {
        $("#submit").addClass("disabled");
        $("#create_dialog div.note:eq(1)").html($('<span class="bad"/>').text("Passwords different"));
      } else {
        if (!pass) {
          $("#submit").addClass("disabled");
          $("#create_dialog div.note:eq(1)").html($('<span class="bad"/>').text("Enter a password"));
        } else if (pass.length < 5) {
          $("#submit").addClass("disabled");
          $("#create_dialog div.note:eq(1)").html($('<span class="bad"/>').text("Password too short"));
        } else {
          $("#create_dialog div.note:eq(1)").html($('<span class="good"/>').text("Password OK"))
        }
      }
    }

    // watch input dialogs
    $("#create_dialog input:first").unbind('keyup').bind('keyup', function() {
      checkInput();
    });

    $("#create_dialog input:gt(0)").unbind('keyup').bind('keyup', checkInput);

    // do a check at load time, in case the user is using the back button (enables the continue button!)
    checkInput();

    $("#create_dialog").fadeIn(500);
  }


  function errorOut(trans, code) {
    function getVerboseMessage(code) {
      var msgs = {
        "canceled": "user canceled selection",
        "notImplemented": "the user tried to invoke behavior that's not yet implemented",
        "serverError": "a technical problem was encountered while trying to communicate with FirefoxID servers."
      };
      var msg = msgs[code];
      if (!msg) {
        alert("need verbose message for " + code); 
        msg = "unknown error"
      }
      return msg;
    }
    trans.error(code, getVerboseMessage(code));
    window.self.close();
  }

  chan.bind("getVerifiedEmail", function(trans, s) {
    trans.delayReturn(true);

    remoteOrigin = trans.origin;

    // set the requesting site
    $(".sitename").text(trans.origin.replace(/^.*:\/\//, ""));

    // check to see if there's any pubkeys stored in the browser
    var haveIDs = false;
    try {
      var emails = JSON.parse(window.localStorage.emails);
      if (typeof emails !== 'object') throw "emails blob bogus!";
      for (var k in emails) {
        if (!emails.hasOwnProperty(k)) continue;
        haveIDs = true;
        break;
      }
    } catch(e) {
      window.localStorage.emails = JSON.stringify({});
    }

    if (haveIDs) {
      runSignInDialog(function(rv) {
        trans.complete(rv);
      }, function(error) {
        errorOut(trans, error);
      });
    } else {
      runAuthenticateDialog(function(rv) {
        trans.complete(rv);
      }, function(error) {
        errorOut(trans, error);
      });
    }
  });
})();
