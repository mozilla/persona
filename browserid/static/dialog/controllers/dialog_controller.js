//
// a JMVC controller for the browserid dialog
//

$.Controller("Dialog", {}, {
    init: function(el) {
      var chan = setupChannel(this);
      
      this.element.html("views/body.ejs", {});
      this.element.show();

      // keep track of where we are and what we do on success and error
      this.onsuccess = null;
      this.onerror = null;
    },

    setupEnterKey: function() {
      $("input").keyup(function(e) {
          if(e.which == 13) {
            $('.submit').click();
            e.preventDefault();
          }
        });
    },

    renderTemplates: function(body, body_vars, footer, footer_vars) {
      if (body)
        $('#dialog').html(body, body_vars).hide().fadeIn(300);

      if (footer)
        $('#bottom-bar').html(footer, footer_vars);
    },
    
    "#suggest_signin click": function(event) {
      this.doAuthenticate();
    },
      
    "#signin click": function(event) {
      var email = $("#email_input").val();
      var pass = $("#password_input").val();

      var self = this;

      $.ajax({
          url: '/wsapi/authenticate_user?email=' + encodeURIComponent(email) + '&pass=' + encodeURIComponent(pass),
            success: function(status, textStatus, jqXHR) {
            var authenticated = JSON.parse(status);
            if (!authenticated) {
              self.find("#nosuchaccount").hide().fadeIn(400);
            } else {
              self.doWait("Finishing Log In...",
                          "In just a moment you'll be logged into BrowserID.");
              
              self.syncIdentities();
            }
          },
            error: function() {
            runErrorDialog(
                           "serverError",
                           "Error Authenticating!",
                           "There was a technical problem while trying to log you in.  Yucky!");
          }
        });
    },

    "#pickemail click": function(event) {
      var email = $("#identities input:checked").val();

      // yay!  now we need to produce an assertion.
      var storedID = getEmails()[email];

      var privkey = storedID.priv;
      var issuer = storedID.issuer;
      var audience = this.remoteOrigin.replace(/^(http|https):\/\//, '');
      var assertion = CryptoStubs.createAssertion(audience, email, privkey, issuer);
      this.onsuccess(assertion);
    },

    "#addemail click": function(event) {
      this.doNewEmail();
    },

    "#addemail_button click": function(event) {
      // add the actual email
      // now we need to actually try to stage the creation of this account.
      var email = $("#email_input").val();
      var keypair = CryptoStubs.genKeyPair();

      var self = this;

      // kick the user to waiting/status page while we talk to the server.
      this.doWait(
        "One Moment Please...",
        "We're adding this email to your account, this should only take a couple seconds."
      );

      $.ajax({
        url: '/wsapi/add_email?email=' + encodeURIComponent(email)
              + '&pubkey=' + encodeURIComponent(keypair.pub)
              + '&site=' + encodeURIComponent(this.remoteOrigin.replace(/^(http|https):\/\//, '')),
        success: function() {
          // email successfully staged, now wait for email confirmation
          self.doConfirmEmail(email, keypair);
        },
        error: function() {
          runErrorDialog(
            "serverError",
            "Error Adding Address!",
            "There was a technical problem while trying to add this email to your account.  Yucky.");
        }
      });
    },

    "#notme click": function(event) {
      clearEmails();
      var self = this;
      $.get("/wsapi/logout", function() {
          self.doAuthenticate();
      });
    },
      
    "#create click": function(event) {
      this.doCreate();
    },

    "#forgotpassword click": function(event) {
      this.doForgotPassword();
    },
            
    "#cancel click": function(event) {
      this.onerror("canceled");
    },

    "#back click": function(event) {
      this.doStart();
    },

    "#continue_button click": function(event) {
      if (!$("#continue_button").hasClass('disabled')) {
        this.doSignIn();
      }
    },

    "#create_continue click": function(event) {
      // now we need to actually try to stage the creation of this account.
      var email = this.find("#email_input").val();
      var pass = this.find("#password_input").val();
      var keypair = CryptoStubs.genKeyPair();

      this.doWait(
        "One Moment Please...",
        "We're creating your account, this should only take a couple seconds");

      var self = this;

      $.ajax({
          url: '/wsapi/stage_user?email=' + encodeURIComponent(email)
            + '&pass=' + encodeURIComponent(pass)
            + '&pubkey=' + encodeURIComponent(keypair.pub)
            + '&site=' + encodeURIComponent(this.remoteOrigin.replace(/^(http|https):\/\//, '')),
            success: function() {
            // account successfully staged, now wait for email confirmation
            self.doConfirmEmail(email, keypair);
          },
            error: function() {
            runErrorDialog(
                           "serverError",
                           "Error Creating Account!",
                           "There was a technical problem while trying to create your account.  Yucky.");
          }
        });
    },

    getVerifiedEmail: function(origin_url, onsuccess, onerror) {
      this.onsuccess = onsuccess;
      this.onerror = onerror;
      this.remoteOrigin = origin_url.replace(/^.*:\/\//, "");
      this.doStart();
    },

    doStart: function() {
      // check to see if there's any pubkeys stored in the browser
      var haveIDs = _.keys(getEmails()).length > 0;
      var self = this;

      // wherever shall we start?
      if (haveIDs) {
        this.doSignIn();
      } else {
        // do we even need to authenticate?
        this.checkAuth(function() {
            self.syncIdentities();
          }, function() {
            self.doAuthenticate();
          });
      }
    },
      
    doSignIn: function() {
      this.renderTemplates("views/signin.ejs", {sitename: this.remoteOrigin, identities: getEmails()},
                           "views/bottom-pickemail.ejs", {});

      // select the first option
      this.find('input:first').attr('checked', true);
    },

    doAuthenticate: function() {
      this.renderTemplates("views/authenticate.ejs", {sitename: this.remoteOrigin},
                           "views/bottom-signin.ejs", {});

      this.setupEnterKey();
    },
      
    doCreate: function() {
      this.renderTemplates("views/create.ejs", {},
                           "views/bottom-continue.ejs", {});

      var checkedEmails = {};
      var emailCheckState = null;
      var nextEmailToCheck = null;
      var self = this;

      function checkInput() {
        // check the email address
        var email = self.find("#email_input").val();
        if (typeof email === 'string' && email.length) {
          var valid = checkedEmails[email];
          if (typeof valid === 'string') {
            // oh noes.  we tried to check this email, but it failed.  let's just not tell the
            // user anything, cause this is a non-critical issue
          } else if (typeof valid === 'boolean') {
            if (valid) {
              self.find("#email_input_note").show();
              self.find("#emailinuse_message").hide();
            } else {
              $("#emailinuse_message").fadeIn(300);
              self.find("#email_input_note").hide();
              $("#in_use_email").text(email);
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
              // FIXME: not sure when this comes up, not refactored
              // $("#create_dialog div.note:eq(0)").html($('<span class="warning"/>').text("Checking address"));
            }
          }
          nextEmailToCheck = email;
          //$("#submit").addClass("disabled");
        }
      
        // next let's check the password entry
        var pass = $("#password_input").val();
        var match = pass === $("#password_verify_input").val();
        self.find('.passwordnote').hide();
        if (!match) {
          self.find('#passwords_different').show();
        } else {
          if (!pass) {
            self.find('#enter_a_password').show();
          } else if (pass.length < 5) {
            self.find('#password_too_short').show();
          } else {
            self.find('#password_ok').show();
          }
        }
      }
      
      // watch input dialogs
      self.find("input").unbind('keyup').bind('keyup', checkInput);
      this.setupEnterKey();
            
      // do a check at load time, in case the user is using the back button (enables the continue button!)
      checkInput();
    },
      
    doForgotPassword: function() {
      this.renderTemplates("views/forgotpassword.ejs", {},
                           "views/bottom-continue.ejs", {});

      var self=this;
      function checkInput() {
        var pass = $("#password_input").val();
        var match = pass === $("#password_verify_input").val();
        self.find('.passwordnote').hide();
        if (!match) {
          self.find('#passwords_different').show();
        } else {
          if (!pass) {
            self.find('#enter_a_password').show();
          } else if (pass.length < 5) {
            self.find('#password_too_short').show();
          } else {
            self.find('#password_ok').show();
          }
        }
      }
      
      // watch input dialogs
      self.find("input").unbind('keyup').bind('keyup', checkInput);
      this.setupEnterKey();
      
      // do a check at load time, in case the user is using the back button (enables the continue button!)
      checkInput();
    },

    doWait: function(title, message) {
      this.renderTemplates("views/wait.ejs", {title: title, message: message});
    },

    doNewEmail: function() {
      this.renderTemplates("views/addemail.ejs", {},
                           "views/bottom-addemail.ejs", {});

      this.setupEnterKey();
    },

    doConfirmEmail: function(email, keypair) {
      this.renderTemplates("views/confirmemail.ejs", {email:email},
                           "views/bottom-confirmemail.ejs", {});

      $('#continue_button').addClass('disabled');

      var self = this;

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
                    // this is a secondary registration from browserid.org, persist
                    // email, keypair, and that fact
                    self.persistAddressAndKeyPair(email, keypair, "browserid.org:443");
                    
                    // and tell the user that everything is really quite awesome.
                    self.find("#waiting_confirmation").hide();
                    self.find("#resendit_action").hide();
                    self.find("#confirmed_notice").show();

                    // enable button
                    $('#continue_button').removeClass('disabled');

                  } else if (status === 'pending') {
                    // try again, what else can we do?
                    pollTimeout = setupRegCheck();
                  } else {
                    runErrorDialog("serverError",
                                   "Registration Failed",
                                   "An error was encountered and the sign up cannot be completed, please try again later.");
                  }
                },
                  error: function(jqXHR, textStatus, errorThrown) {
                  runErrorDialog("serverError", "Registration Failed", jqXHR.responseText);
                }
              });
          }, 3000);
      }
      
      // setup the timeout
      this.pollTimeout = setupRegCheck();

      // FIXME cancel this timeout appropriately on cancel
    },

    persistAddressAndKeyPair: function(email, keypair, issuer) {
      var new_email_obj= {
        created: new Date(),
        pub: keypair.pub,
        priv: keypair.priv
      };
      if (issuer) {
        new_email_obj.issuer = issuer;
      }
      
      addEmail(email, new_email_obj);
    },

    syncIdentities: function() {
      // send up all email/pubkey pairs to the server, it will response with a
      // list of emails that need new keys.  This may include emails in the
      // sent list, and also may include identities registered on other devices.
      // we'll go through the list and generate new keypairs
      
      // identities that don't have an issuer are primary authentications,
      // and we don't need to worry about rekeying them.
      var emails = getEmails();
      var issued_identities = {};
      _(emails).each(function(email_obj, email_address) {
          issued_identities[email_address] = email_obj.pub;
        });
      
      var self = this;

      $.ajax({
          url: '/wsapi/sync_emails',
            type: "post",
            data: JSON.stringify(issued_identities),
            success: function(resp, textStatus, jqXHR) {
            // first remove idenitites that the server doesn't know about
            if (resp.unknown_emails) {
              _(resp.unknown_emails).each(function(email_address) {
                  console.log("removed local identity: " + email_address);
                  removeEmail(email_address);
                });
            }

            // now let's begin iteratively re-keying the emails mentioned in the server provided list
            var emailsToAdd = resp.key_refresh;
            
            function addNextEmail() {
              if (!emailsToAdd || !emailsToAdd.length) {
                self.doSignIn();
                return;
              }

              // pop the first email from the list
              var email = emailsToAdd.shift();
              var keypair = CryptoStubs.genKeyPair();

              $.ajax({
                  url: '/wsapi/set_key?email=' + encodeURIComponent(email) + '&pubkey=' + encodeURIComponent(keypair.pub),
                    success: function() {
                    // update emails list and commit to local storage, then go do the next email
                    self.persistAddressAndKeyPair(email, keypair, "browserid.org:443");
                    addNextEmail();
                  },
                    error: function() {
                    runErrorDialog(
                                   "serverError",
                                   "Error Adding Address!",
                                   "There was a technical problem while trying to synchronize your account.  Yucky.");
                  }
                });
            }

            addNextEmail();
          },
            error: function(jqXHR, textStatus, errorThrown) {
            runErrorDialog("serverError", "Login Failed", jqXHR.responseText);
          }
        });

      
    },

    checkAuth: function(authcb, notauthcb) {
      this.doWait("Communicating with server",
             "Just a moment while we talk with the server.");
      
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
                           "There was a technical problem while trying to log you in.  Yucky!");
          }
        });
  }

  });
