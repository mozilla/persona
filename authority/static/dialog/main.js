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

  function isSuperDomain(domain) {
      return true;
  }

  function getLastUsedEmail() {
    // XXX: really we should keep usage records locally to make this better
    var emails = JSON.parse(window.localStorage.emails);
    for (var e in emails) {
      if (emails.hasOwnProperty(e)) return e;
    }
    return undefined;
  }

  function checkAuthStatus(authcb, notauthcb, onsuccess, onerror) {
    runWaitingDialog(
      "Communicating with server",
      "Just a moment while we talk with the server.",
      onsuccess, onerror);

    $.ajax({
      url: '/wsapi/am_authed',
      success: function(status, textStatus, jqXHR) {
        var authenticated = JSON.parse(status);
        if (!authenticated) {
          notauthcb();
        } else {
          authcb();
        }
      },
      error: function() {
        runErrorDialog(
          "serverError",
          "Error Communicating With Server!",
          "There was a technical problem while trying to log you in.  Yucky!",
          onsuccess, onerror);
      }
    });
  }

  function persistAddressAndKeyPair(email, keypair, issuer)
  {
    var emails = {};
    if (window.localStorage.emails) {
      emails = JSON.parse(window.localStorage.emails);
    }

    emails[email] = {
      created: new Date(),
      pub: keypair.pub,
      priv: keypair.priv
    };
    if (issuer) {
      emails[email].issuer = issuer;
    }

    window.localStorage.emails = JSON.stringify(emails);
  }

  function syncIdentities(onsuccess, onerror) {
    // send up all email/pubkey pairs to the server, it will response with a
    // list of emails that need new keys.  This may include emails in the
    // sent list, and also may include identities registered on other devices.
    // we'll go through the list and generate new keypairs

    // identities that don't have an issuer are primary authentications,
    // and we don't need to worry about rekeying them.
    var issued_identities = { };
    var emails = {};
    if (window.localStorage.emails) {
      emails = JSON.parse(window.localStorage.emails);
    }

    for (var e in emails) {
      if (!emails.hasOwnProperty(e)) continue;
      if (emails[e].issuer) {
        issued_identities[e] = emails[e].pub;
      }
    }

    $.ajax({
      url: '/wsapi/sync_emails',
      type: "post",
      data: JSON.stringify(issued_identities),
      success: function(resp, textStatus, jqXHR) {
        // first remove idenitites that the server doesn't know about
        if (resp.unknown_emails) {
          for (var i = 0; i < resp.unknown_emails; i++) {
            if (emails.hasOwnProperty(resp.unknown_emails[i])) {
              console.log("removed local identity: " + resp.unknown_emails[i]);
              delete emails[resp.unknown_emails[i]];
            }
          }
        }

        // store changes thus far
        window.localStorage.emails = JSON.stringify(emails);

        // now let's begin iteratively re-keying the emails mentioned in the server provided list
        var emailsToAdd = resp.key_refresh;

        function addNextEmail() {
          if (!emailsToAdd || !emailsToAdd.length) {
            runSignInDialog(onsuccess, onerror);
            return;
          }

          // pop the first email from the list
          var email = emailsToAdd.shift();
          var keypair = CryptoStubs.genKeyPair();

          $.ajax({
            url: '/wsapi/set_key?email=' + encodeURIComponent(email) + '&pubkey=' + encodeURIComponent(keypair.pub),
            success: function() {
              // update emails list and commit to local storage, then go do the next email
              persistAddressAndKeyPair(email, keypair, "eyedee.me:443");
              addNextEmail();
            },
            error: function() {
              runErrorDialog(
                "serverError",
                "Error Adding Address!",
                "There was a technical problem while trying to synchronize your account.  Yucky.",
                onsuccess, onerror);
            }
          });
        }

        addNextEmail();
      },
      error: function(jqXHR, textStatus, errorThrown) {
        runErrorDialog("serverError", "Login Failed", jqXHR.responseText, onsuccess, onerror);
      }
    });

  }

  function runSignInDialog(onsuccess, onerror) {
    $(".dialog").hide();

    $("#back").hide();
    $("#cancel").show().unbind('click').click(function() {
      onerror("canceled");
    });
    $("#submit").show().unbind('click').click(function() {
      var email = $("#identities input:checked").parent().find("div").text();

      // yay!  now we need to produce an assertion.
      var storedID = JSON.parse(window.localStorage.emails)[email];

      var privkey = storedID.priv;
      var issuer = storedID.issuer;
      var audience = remoteOrigin.replace(/^(http|https):\/\//, '');
      var assertion = CryptoStubs.createAssertion(audience, email, privkey, issuer);
      onsuccess(assertion);
    }).text("Sign In").removeClass("disabled").focus();

    $("#sign_in_dialog div.actions div.action:first a").unbind('click').click(function() {
      checkAuthStatus(
        function() {
          // the user is authenticated, they can go ahead and try to add a new address
          runAddNewAddressDialog(onsuccess, onerror);
        },
        function() {
          // the user is not authed, they must enter their email/password
          runAuthenticateDialog(getLastUsedEmail(), onsuccess, onerror);
        },
        onsuccess, onerror);
    });

    $("#sign_in_dialog div.actions div.action:eq(1) a").unbind('click').click(function() {
      // not your email addresses?  we'll just purge local storage and click you over
      // to the login page.
      window.localStorage.emails = JSON.stringify({});
      runAuthenticateDialog(undefined, onsuccess, onerror);
    });

    // now populate the selection list with all available emails
    // we assume there are identities available, because without them 
    var emails = JSON.parse(window.localStorage.emails);
    var first = true; 
    $("form#identities").empty();
    for (var k in emails) {
      var id = $("<div />")
        .append($("<input />").attr('type', 'radio').attr('name', 'identity').attr('checked', first))
        .append($("<div />").text(k));
      first = false;
      id.appendTo($("form#identities"));
    }
    $("form#identities > div").unbind('click').click(function() {
      $(this).find(':first').attr('checked', true);
    });

    $("#sign_in_dialog").fadeIn(500);
  }

  function runAuthenticateDialog(email, onsuccess, onerror) {
    $(".dialog").hide();
    $("#back").hide();
    $("#cancel").show().unbind('click').click(function() {
      onerror("canceled");
    });
    $("#submit").show().unbind('click').click(function() {
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
      if (email.length > 0 && pass.length > 0) $("#submit").removeClass('disabled');
      else $("#submit").addClass('disabled');
    });

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
              // this is a secondary registration from eyedee.me, persist
              // email, keypair, and that fact
              persistAddressAndKeyPair(email, keypair, "eyedee.me:443");

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

  function runAddNewAddressDialog(onsuccess, onerror) {
    $(".dialog").hide();

    $("#back").show().unbind('click').click(function() {
      runSignInDialog(onsuccess, onerror);
    });
    $("#cancel").show().unbind('click').click(function() {
      onerror("canceled");
    });
    $("#submit").show().unbind('click').click(function() {
      // ignore the click if we're disabled
      if ($(this).hasClass('disabled')) return true;

      // now we need to actually try to stage the creation of this account.
      var email = $("#add_email_dialog input:eq(0)").val();
      var keypair = CryptoStubs.genKeyPair();

      // kick the user to waiting/status page while we talk to the server.
      runWaitingDialog(
        "One Moment Please...",
        "We're adding this email to your account, this should only take a couple seconds.",
        onsuccess,
        onerror
      );

      $.ajax({
        url: '/wsapi/add_email?email=' + encodeURIComponent(email) + '&pubkey=' + encodeURIComponent(keypair.pub),
        success: function() {
          // email successfully staged, now wait for email confirmation
          runConfirmEmailDialog(email, keypair, onsuccess, onerror);
        },
        error: function() {
          runErrorDialog(
            "serverError",
            "Error Adding Address!",
            "There was a technical problem while trying to add this email to your account.  Yucky.",
            onsuccess, onerror);
        }
      });
    }).text("Add").addClass('disabled');

    $("#add_email_dialog input").unbind('keyup').bind('keyup', function() {
      var email = $("#add_email_dialog input:eq(0)").val();
      if (email.length > 0) {
        $("#submit").removeClass('disabled');
      } else {
        $("#submit").addClass('disabled');
      }
    });

    // clear previous input
    $("#add_email_dialog input:eq(0)").val("");

    $("#add_email_dialog").fadeIn(500);
  }

  function runCreateDialog(onsuccess, onerror) {
    $(".dialog").hide();

    $("#back").show().unbind('click').click(function() {
      runAuthenticateDialog(undefined, onsuccess, onerror);
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

    $("#create_dialog div.attention_lame").hide();
    $("#create_dialog div.attention_lame a").unbind('click').click(function() {
      var email = $("#create_dialog input:eq(0)").val();
      runAuthenticateDialog(email, onsuccess, onerror);
    });

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
            $("#create_dialog div.attention_lame").hide();
          } else {
            $("#create_dialog div.attention_lame").fadeIn(300);
            $("#create_dialog div.attention_lame span.email").text(email);
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
    $("#create_dialog input").unbind('keyup').bind('keyup', checkInput);

    // do a check at load time, in case the user is using the back button (enables the continue button!)
    checkInput();

    $("#create_dialog").fadeIn(500);
  }

  function errorOut(trans, code) {
    function getVerboseMessage(code) {
      var msgs = {
        "canceled": "user canceled selection",
        "notImplemented": "the user tried to invoke behavior that's not yet implemented",
        "serverError": "a technical problem was encountered while trying to communicate with BrowserID servers."
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

  //------------------------------------------------------------------------------------
  // Begin RPC bindings:
  //------------------------------------------------------------------------------------

  // from
  // http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
  function new_guid() {
      var S4 = function() {
          return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
      };
      return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
  }
  
  // pre-auth binding (Ben)
  if (!window.localStorage.PREAUTHS)
      window.localStorage.PREAUTHS = {};
  chan.bind("preauthEmail", function(trans, email) {
          if (!isSuperDomain(trans.origin)) {
              alert('not a super domain!');
              return;
          }

          // only one preauth, since this shouldn't happen in parallel
          var guid = new_guid();
          window.localStorage.PREAUTHS[guid] = {'at': new Date(), 'email': email};

          // the guid is returned, it will be necessary
          return guid;
      });

  chan.bind("getSpecificVerifiedEmail", function(trans, params) {
    var email = params[0], guid = params[1];
    alert(email);
    alert(guid);
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

    function onsuccess(rv) {
      trans.complete(rv);
    }
    function onerror(error) {
      errorOut(trans, error);
    }

    // wherever shall we start?
    if (haveIDs) {
      runSignInDialog(onsuccess, onerror);
    } else {
      // do we even need to authenticate?
      checkAuthStatus(function() {
        syncIdentities(onsuccess, onerror);
      }, function() {
        runAuthenticateDialog(undefined, onsuccess, onerror);
      }, onsuccess, onerror);
    }
      });

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

    function onsuccess(rv) {
      trans.complete(rv);
    }
    function onerror(error) {
      errorOut(trans, error);
    }

    // wherever shall we start?
    if (haveIDs) {
      runSignInDialog(onsuccess, onerror);
    } else {
      // do we even need to authenticate?
      checkAuthStatus(function() {
        syncIdentities(onsuccess, onerror);
      }, function() {
        runAuthenticateDialog(undefined, onsuccess, onerror);
      }, onsuccess, onerror);
    }
  });

  // 'Enter' in any input field triggers a click on the submit button
  $('input').keypress(function(e){
    if(e.which == 13) {
      $('#submit').click();
      e.preventDefault();
    }
  });
})();
