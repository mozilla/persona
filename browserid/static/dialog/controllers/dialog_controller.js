/*jshint browser:true, jQuery: true, forin: true, laxbreak:true */                                             
/*global Channel:true, CryptoStubs:true, alert:true, errorOut:true, setupChannel:true, getEmails:true, clearEmails: true, console: true, _: true, pollTimeout: true, addEmail: true, removeEmail:true */

//
// a JMVC controller for the browserid dialog
//

(function() {
"use strict";

$.Controller("Dialog", {}, {
    init: function(el) {
      // FIXME: there's a small chance the CSRF token doesn't come back in time.
      this._getCSRF();

      var html = $.View("//dialog/views/body.ejs", {});
      this.element.html(html);
      this.element.show();

      // keep track of where we are and what we do on success and error
      this.onsuccess = null;
      this.onerror = null;
      var chan = setupChannel(this);
    },
      
    _getCSRF: function(cb) {
      // go get CSRF token
      BrowserIDNetwork.csrf(cb);
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
      if (body) {
        var bodyHtml = $.View("//dialog/views/" + body, body_vars);
        $('#dialog').html(bodyHtml).hide().fadeIn(300, function() {
          $('#dialog input').eq(0).focus(); 
        });
      }

      if (footer) {
        var footerHtml = $.View("//dialog/views/" + footer, footer_vars);
        $('#bottom-bar').html(footerHtml);
      }
      this.setupEnterKey();
    },
    
    "#suggest_signin click": function(event) {
      this.doAuthenticate();
    },
      
    "#signin click": function(event) {
      var email = $("#email_input").val();
      var pass = $("#password_input").val();

      var self = this;

      BrowserIDNetwork.authenticate(email, pass, function(authenticated) {
        if (!authenticated) {
          self.find("#nosuchaccount").hide().fadeIn(400);
        } else {
          self.doWait(BrowserIDWait.authentication);
          self.syncIdentities();
        }
      }, function(resp) {
        runErrorDialog(BrowserIDErrors.authentication);
      });
    },

    "#pickemail click": function(event) {
      var email = $("#identities input:checked").val();

      // yay!  now we need to produce an assertion.
      var storedID = getEmails()[email];

      var privkey = storedID.priv;
      var issuer = storedID.issuer;
      var audience = BrowserIDNetwork.origin;
      var assertion = CryptoStubs.createAssertion(audience, email, privkey, issuer);
      // Clear onerror before the call to onsuccess - the code to onsuccess 
      // calls window.close, which would trigger the onerror callback if we 
      // tried this afterwards.
      this.onerror = null;
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
      this.doWait(BrowserIDWait.addEmail);

      BrowserIDNetwork.addEmail(email, keypair, function() {
          // email successfully staged, now wait for email confirmation
          self.doConfirmEmail(email, keypair);
        },
        function() {
          runErrorDialog(BrowserIDErrors.addEmail);
        });
    },

    "#notme click": function(event) {
      clearEmails();
      BrowserIDNetwork.logout(this.doAuthenticate.bind(this));
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
      if ($('#create_continue').hasClass('disabled'))
        return;

      // now we need to actually try to stage the creation of this account.
      var email = this.find("#email_input").val();
      var pass = this.find("#password_input").val();
      var keypair = CryptoStubs.genKeyPair();

      this.doWait(BrowserIDWait.createAccount);

      var self = this;
      BrowserIDNetwork.stageUser(email, pass, keypair, function() {
          self.doConfirmEmail(email, keypair);
        },
        function() {
          runErrorDialog(BrowserIDErrors.createAccount);
        });
    },

    getVerifiedEmail: function(origin_url, onsuccess, onerror) {
      this.onsuccess = onsuccess;
      this.onerror = onerror;
      BrowserIDNetwork.setOrigin(origin_url);
      this.doStart();
      var me=this;
      $(window).bind("unload", function() {
        // In the success case, me.onerror will have been cleared before unload 
        // is triggered.
        if (me.onerror) {
          me.onerror("canceled");
        }
      });
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
      this.renderTemplates("signin.ejs", {sitename: BrowserIDNetwork.origin, identities: getEmails()},
                           "bottom-pickemail.ejs", {});

      // select the first option
      this.find('input:first').attr('checked', true);
    },

    doAuthenticate: function() {
      this.renderTemplates("authenticate.ejs", {sitename: BrowserIDNetwork.origin},
                           "bottom-signin.ejs", {});

    },
      
    doCreate: function() {
      this.renderTemplates("create.ejs", {},
                           "bottom-continue.ejs", {});

      $('#create_continue').addClass('disabled');

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
                  BrowserIDNetwork.haveEmail(checkingNow, function(success) {
                        checkedEmails[checkingNow] = success;
                        emailCheckState = undefined;
                        checkInput();
                      },function() {
                        // some kind of error was encountered.  This is non-critical, we'll simply ignore it
                        // and mark this email check as failed.
                        checkedEmails[checkingNow] = "server failed";
                        emailCheckState = undefined;
                        checkInput();
                      }
                    );
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
        $('#create_continue').addClass('disabled');
        if (!match) {
          self.find('#passwords_different').show();
        } else {
          if (!pass) {
            self.find('#enter_a_password').show();
          } else if (pass.length < 5) {
            self.find('#password_too_short').show();
          } else {
            self.find('#password_ok').show();
            $('#create_continue').removeClass('disabled');
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
      this.renderTemplates("forgotpassword.ejs", {},
                           "bottom-continue.ejs", {});

      $('#create_continue').addClass('disabled');

      var self=this;
      function checkInput() {
        var pass = $("#password_input").val();
        var match = pass === $("#password_verify_input").val();
        self.find('.passwordnote').hide();
        $('#create_continue').addClass('disabled');
        if (!match) {
          self.find('#passwords_different').show();
        } else {
          if (!pass) {
            self.find('#enter_a_password').show();
          } else if (pass.length < 5) {
            self.find('#password_too_short').show();
          } else {
            self.find('#password_ok').show();
            $('#create_continue').removeClass('disabled');
          }
        }
      }
      
      // watch input dialogs
      self.find("input").unbind('keyup').bind('keyup', checkInput);
      this.setupEnterKey();
      
      // do a check at load time, in case the user is using the back button (enables the continue button!)
      checkInput();
    },

    doWait: function(info) {
      this.renderTemplates("wait.ejs", {title: info.message, message: info.description});
    },

    doNewEmail: function() {
      this.renderTemplates("addemail.ejs", {},
                           "bottom-addemail.ejs", {});

      this.setupEnterKey();
    },

    doConfirmEmail: function(email, keypair) {
      this.renderTemplates("confirmemail.ejs", {email:email},
                           "bottom-confirmemail.ejs", {});

      $('#continue_button').addClass('disabled');

      var self = this;

      // now poll every 3s waiting for the user to complete confirmation
      function setupRegCheck() {
        return setTimeout(function() {
          BrowserIDNetwork.checkRegistration(function(status) {
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
              runErrorDialog(BrowserIDErrors.registration);
            }
          },
          function(jqXHR, textStatus, errorThrown) {
              runErrorDialog(BrowserIDErrors.registration);
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
      BrowserIDNetwork.syncEmails(issued_identities, 
        function onKeySyncSuccess(email, keypair) {
          self.persistAddressAndKeyPair(email, keypair, "browserid.org:443");
        },
        function onKeySyncFailure() {
          runErrorDialog(BrowserIDErrors.syncAddress);
        },
        function onSuccess() {
          self.doSignIn();
        },
        function onFailure(jqXHR, textStatus, errorThrown) {
            runErrorDialog(BrowserIDErrors.signIn);
      });

    },

    checkAuth: function(authcb, notauthcb) {
      this.doWait(BrowserIDWait.checkAuth);
      
      BrowserIDNetwork.checkAuth(function(authenticated) {
        if (!authenticated) {
          notauthcb();
        } else {
          authcb();
        }
      }, function() {
        runErrorDialog(BrowserIDErrors.checkAuthentication);
      });
  }

  });

  function runErrorDialog(info) {
    $(".dialog").hide();

    $("#error_dialog div.title").text(info.message);
    $("#error_dialog div.content").text(info.description);

    $("#back").hide();
    $("#cancel").hide();
    $("#submit").show().unbind('click').click(function() {
    }).text("Close");

    $("#error_dialog").fadeIn(500);
  }

}());
