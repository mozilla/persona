/*jshint brgwser:true, jQuery: true, forin: true, laxbreak:true */                                             
/*global Channel:true, CryptoStubs:true, alert:true, errorOut:true, setupChannel:true, getEmails:true, clearEmails: true, console: true, _: true, pollTimeout: true, addEmail: true, removeEmail:true, BrowserIDNetwork: true, BrowserIDWait:true, BrowserIDErrors: true, runErrorDialog:true */ 
//
// a JMVC controller for the browserid dialog
//

(function() {
"use strict";

PageController.extend("Dialog", {}, {
    init: function(el) {
      var html = $.View("//dialog/views/body.ejs", {});
      this.element.html(html);
      this.element.show();

      // keep track of where we are and what we do on success and error
      this.onsuccess = null;
      this.onerror = null;
      var chan = setupChannel(this);
      this.stateMachine();
    },
      
    "#suggest_signin click": function(event) {
      this.doAuthenticate();
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
          self.runErrorDialog(BrowserIDErrors.addEmail);
        });
    },

    "#cancel click": function(event) {
      this.onerror("canceled");
    },

    "#back click": function(event) {
      this.doStart();
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


    stateMachine: function() {
      var self=this, hub = OpenAjax.hub, el = this.element;

      hub.subscribe("createaccount:created", function(msg, info) {
        self.doConfirmEmail(info.email, info.keypair);
      });

      hub.subscribe("authenticate:authenticated", function() {
        self.syncIdentities();
      });

      hub.subscribe("authenticate:createuser", function() {
        self.doCreate();
      });

      hub.subscribe("authenticate:forgotpassword", function() {
        self.doForgotPassword();
      });

      hub.subscribe("checkregistration:confirmed", function() {
        self.doRegistrationConfirmed();
      });

      hub.subscribe("checkregistration:complete", function() {
        self.doSignIn();
      });

      hub.subscribe("chooseemail:complete", function(msg, info) {
        self.doEmailSelected(info.email);
      });

      hub.subscribe("chooseemail:addemail", function() {
        self.doNewEmail();
      });

      hub.subscribe("chooseemail:notme", function() {
        self.doNotMe();
      });

      hub.subscribe("cancel", function() {
        // cancel
        if(self.onerror) {
          self.onerror("cancelled");
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
      this.element.chooseemail();
    },

    doAuthenticate: function() {
      this.element.authenticate();
    },
      
    doCreate: function() {
      this.element.createaccount();
    },
      
    doForgotPassword: function() {
      this.element.forgotpassword();
    },

    doWait: function(info) {
      this.renderTemplates("wait.ejs", {title: info.message, message: info.description});
    },

    doNewEmail: function() {
      this.renderTemplates("addemail.ejs", {},
                           "bottom-addemail.ejs", {});

    },

    doConfirmEmail: function(email, keypair) {
      this.confirmEmail = email;
      this.confirmKeypair = keypair;

      this.element.checkregistration({email: email});
    },

    doRegistrationConfirmed: function() {
        var self = this;
        // this is a secondary registration from browserid.org, persist
        // email, keypair, and that fact
        self.persistAddressAndKeyPair(self.confirmEmail, 
          self.confirmKeypair, "browserid.org:443");
        self.syncidentities();

    },

    doEmailSelected: function(email) {
      var self=this,
          // yay!  now we need to produce an assertion.
          storedID = getEmails()[email],
          privkey = storedID.priv,
          issuer = storedID.issuer,
          audience = BrowserIDNetwork.origin,
          assertion = CryptoStubs.createAssertion(audience, email, privkey, issuer);

      // Clear onerror before the call to onsuccess - the code to onsuccess 
      // calls window.close, which would trigger the onerror callback if we 
      // tried this afterwards.
      self.onerror = null;
      self.onsuccess(assertion);
    },

    doNotMe: function() {
      clearEmails();
      BrowserIDNetwork.logout(this.doAuthenticate.bind(this));
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
          self.runErrorDialog(BrowserIDErrors.syncAddress);
        },
        function onSuccess() {
          self.doSignIn();
        },
        function onFailure(jqXHR, textStatus, errorThrown) {
          self.runErrorDialog(BrowserIDErrors.signIn);
        }
      );

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
        self.runErrorDialog(BrowserIDErrors.checkAuthentication);
      });
  }

  });


}());
