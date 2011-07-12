//
// a JMVC controller for the browserid dialog
//

$.Controller("Dialog", {}, {
    init: function(el) {
      var chan = setupChannel(this);
      
      this.element.html("views/body.ejs", {});
      this.element.show();

      // keep track of where we are and what we do on success and error
      this.state = null;
      this.onsuccess = null;
      this.onerror = null;
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
            
    "#cancel click": function(event) {
      this.onerror("canceled");
    },

    "#continue_button click": function(event) {
      this.doSignIn();
    },

    getVerifiedEmail: function(remoteOrigin, onsuccess, onerror) {
      // check to see if there's any pubkeys stored in the browser
      var haveIDs = _.keys(getEmails()).length > 0;
      var self = this;

      this.onsuccess = onsuccess;
      this.onerror = onerror;
      this.remoteOrigin = remoteOrigin;

      // wherever shall we start?
      if (haveIDs) {
        this.doSignIn();
      } else {
        // do we even need to authenticate?
        this.checkAuth(function() {
            self.syncIdentities();
          }, function() {
            self.doAuthenticate();
          }, onsuccess, onerror);
      }
    },
      
    doSignIn: function() {
      this.state = "signin";
      $('#dialog').html("views/signin.ejs", {sitename: this.remoteOrigin, identities: getEmails()});
      $('#bottom-bar').html("views/bottom-pickemail.ejs", {});
    },

    doAuthenticate: function() {
      this.state = "authenticate";
      $('#dialog').html("views/authenticate.ejs", {sitename: this.remoteOrigin});
      $('#bottom-bar').html("views/bottom-signin.ejs", {});
    },

    doWait: function(title, message) {
      $('#dialog').html("views/wait.ejs", {title: title, message: message});
    },

    doNewEmail: function() {
      $('#dialog').html("views/addemail.ejs", {});
      $('#bottom-bar').html("views/bottom-addemail.ejs", {});
    },

    doConfirmEmail: function(email, keypair) {
      $('#dialog').html("views/confirmemail.ejs", {email:email});
      $('#bottom-bar').html("");

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
                    self.find("#confirmed_notice").show();
                    self.find('#bottom-bar').html("views/bottom-confirmemail.ejs", {});
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