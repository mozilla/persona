/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BrowserID.User = (function() {
  "use strict";

  var origin,
      bid = BrowserID,
      network = bid.Network,
      storage = bid.Storage,
      helpers = bid.Helpers,
      mediator = bid.Mediator,
      cryptoLoader = bid.CryptoLoader,
      User,
      pollTimeout,
      provisioning = bid.Provisioning,
      addressCache = {},
      primaryAuthCache = {},
      complete = bid.Helpers.complete,
      registrationComplete = false,
      POLL_DURATION = 3000,
      pollDuration = POLL_DURATION,
      stagedEmail,
      stagedPassword,
      userid,
      auth_status,
      issuer = "default",
      allowUnverified = false;


  // remove identities that are no longer valid
  function cleanupIdentities(onSuccess, onFailure) {
    network.serverTime(function(serverTime) {
      network.domainKeyCreationTime(function(creationTime) {
        // Determine if a certificate is expired.  That will be
        // if it was issued *before* the domain key was last updated or
        // if the certificate expires in less that 5 minutes from now.
        function isExpired(cert) {
          // if it expires in less than 2 minutes, it's too old to use.
          var diff = cert.payload.exp.valueOf() - serverTime.valueOf();
          if (diff < (60 * 2 * 1000)) {
            return true;
          }

          // or if it was issued before the last time the domain key
          // was updated, it's invalid
          if (!cert.payload.iat) {
            helpers.log('Data Format ERROR: expected cert to have iat ' +
              'property, but found none, marking expired');
            return true;
          } else if (cert.payload.iat < creationTime) {
            helpers.log('Certificate issued ' + cert.payload.iat +
              ' is before creation time ' + creationTime + ', marking expired');
            return true;
          }

          return false;
        }

        var emails = storage.getEmails(issuer);
        var issued_identities = {};
        cryptoLoader.load(function(jwcrypto) {
          _.each(emails, function(email_obj, email_address) {
            try {
              email_obj.pub = jwcrypto.loadPublicKeyFromObject(email_obj.pub);
            } catch (x) {
              storage.invalidateEmail(email_address, issuer);
              return;
            }

            // no cert? reset
            if (!email_obj.cert) {
              storage.invalidateEmail(email_address, issuer);
            } else {
              try {
                // parse the cert
                var cert = jwcrypto.extractComponents(
                                emails[email_address].cert);

                // check if this certificate is still valid.
                if (isExpired(cert)) {
                  storage.invalidateEmail(email_address, issuer);
                }

              } catch (e) {
                // error parsing the certificate!  Maybe it's of an
                // old/different format?  just delete it.
                helpers.log("error parsing cert for"+ email_address +":" + e);
                storage.invalidateEmail(email_address, issuer);
              }
            }
          });
          onSuccess();
        });
      }, onFailure);
    }, onFailure);
  }

  function stageAddressVerification(email, password, stagingStrategy,
      onComplete, onFailure) {
    // These are saved for the addressVerificationPoll.  If there is
    // a stagedEmail or stagedPassword when the poll completes, try to
    // authenticate the user.
    stagedEmail = email;
    stagedPassword = password;

    // stagingStrategy is a curried function that will have all but the
    // onComplete and onFailure functions already set up.
    stagingStrategy(function(status) {
      if (!status) status = { success: false };
      var staged = status.success;

      if (!staged) status.reason = "throttle";
      // Used on the main site when the user verifies - once
      // verification is complete, the user is redirected back to the
      // RP and logged in.
      var site = User.getReturnTo();
      if (staged && site) storage.setReturnTo(site);
      complete(onComplete, status);
    }, onFailure);
  }

  function completeAddressVerification(completeFunc, token, password, onComplete, onFailure) {
    User.tokenInfo(token, function(info) {
      var invalidInfo = { valid: false };
      if (info) {
        completeFunc(token, password, function (resp) {
          var valid = resp.success;
          var result = invalidInfo;

          if (valid) {
            result = _.extend({ valid: valid }, info);
            storage.setReturnTo("");
            // If the user has successfully completed an address verification,
            // they are authenticated to the password status.
            auth_status = "password";
          }

          complete(onComplete, result);
        }, onFailure);
      } else if (onComplete) {
        onComplete(invalidInfo);
      }
    }, onFailure);

  }

  /**
   * onSuccess, if called, will return with "complete" if the verification
   * completes and the user is authed to the "password" level, or "mustAuth" if
   * the user must enter their password.
   */
  function addressVerificationPoll(checkFunc, email, onSuccess, onFailure) {
    function userVerified(resp) {
      if (stagedEmail && stagedPassword) {
        // The user has set their email and password as part of the
        // staging flow. Log them in now just to make sure their
        // authentication creds are up to date. This fixes a problem where the
        // backend incorrectly sends a mustAuth status to users who have just
        // completed verification. See issue #1682
        // https://github.com/mozilla/browserid/issues/1682
        User.authenticate(stagedEmail, stagedPassword, function(authenticated) {
          // The address verification poll does not send back a userid.
          // Use the userid set in User.authenticate
          resp.userid = userid;
          resp.status = authenticated ? "complete" : "mustAuth";
          completeVerification(resp);
        }, onFailure);

        stagedEmail = stagedPassword = null;
      }
      else {
        // If the user's completionStatus is complete but their
        // original authStatus was not password, meaning they have
        // not entered in their authentication credentials this session.
        // If the user is not authenticated to the password level, the backend
        // will reject any requests to certify a key because the user will
        // not have the correct creds to do so.
        // See issue #2088 https://github.com/mozilla/browserid/issues/2088
        //
        // Since a user may have entered their password on the main site during
        // a password reset, the only reliable way to know the user's auth
        // status is to ask the backend. Clear the current context and ask
        // the backend for an updated session_context.
        clearContext();
        User.checkAuthentication(function(authStatus) {
          if (resp.status === "complete" && authStatus !== "password")
            resp.status = "mustAuth";

          // The address verification poll does not send back a userid.
          // use the userid set in onContextChange.
          resp.userid = userid;
          completeVerification(resp);
        }, onFailure);
      }
    }

    function completeVerification(resp) {
      // As soon as the registration comes back as complete, we should
      // ensure that the stagedOnBehalfOf is cleared so there is no stale
      // data.
      storage.setReturnTo("");

      // registrationComplete is used in shouldAskIfUsersComputer to
      // prevent the user from seeing the "is this your computer" screen if
      // they just completed a registration.
      registrationComplete = true;

      // If the status is still complete, the user's auth status is
      // definitively password.
      if (resp.status === "complete") {
        setAuthenticationStatus("password", resp.userid);
      }

      // If there is any sort of userid and auth_status, sync the emails.
      // If the user has to enter their password and status is mustAuth,
      // the required_email module expects the emails to already be synced.
      // See issue #3178
      if (userid && auth_status) {
        User.syncEmails(function() {
          complete(onSuccess, resp.status);
        }, onFailure);
      }
      else {
        complete(onSuccess, resp.status);
      }
    }

    function poll() {
      checkFunc(email, function(resp) {
        var status = resp.status;
        // registration status checks the status of the last initiated registration,
        // it's possible return values are:
        //   'complete' - registration has been completed
        //   'pending'  - a registration is in progress
        //   'mustAuth' - user must authenticate
        //   'noRegistration' - no registration is in progress
        if (status === "complete" || status === "mustAuth") {
          userVerified(resp);
        }
        else if (status === 'pending') {
          pollTimeout = setTimeout(poll, pollDuration);
        }
        else {
          complete(onFailure, status);
        }
      }, onFailure);
    }

    poll();
  }

  function cancelRegistrationPoll() {
    if (pollTimeout) {
      clearTimeout(pollTimeout);
      pollTimeout = null;
    }
  }

  function getIdPName(addressInfo) {
    return helpers.getDomainFromEmail(addressInfo.email);
  }

  /**
   * Persist an address and key pair locally.
   * @method persistEmailKeypair
   * @param {string} email - Email address to persist.
   * @param {object} keypair - Key pair to save
   * @param {function} [onComplete] - Called on successful completion.
   * @param {function} [onFailure] - Called on error.
   */
  function persistEmailKeypair(email, keypair, cert, onComplete, onFailure) {
    // XXX This needs to be looked at to make sure caching does not bite us.
    User.addressInfo(email, function(info) {
      var now = new Date();
      var email_obj = storage.getEmail(email, issuer) || {
        created: now
      };

      _.extend(email_obj, {
        updated: now,
        pub: keypair.publicKey.toSimpleObject(),
        priv: keypair.secretKey.toSimpleObject(),
        cert: cert
      });

      if (info.state === "unverified") {
        email_obj.unverified = true;
      } else if (email_obj.unverified) {
        delete email_obj.unverified;
      }

      storage.addEmail(email, email_obj, issuer);
      if (onComplete) onComplete(true);
    }, onFailure);
  }

  /**
   * Persist an email address without a keypair
   * @method persistEmailWithoutKeypair
   * @param {object} options - options to save
   * @param {string} options.email - Email address to persist.
   */
  function persistEmailWithoutKeypair(options, issuer) {
    storage.addEmail(options.email, {
      created: new Date()
    }, issuer);
  }

  /**
   * Certify an identity with the server, persist it to storage if the server
   * says the identity is good
   * @method certifyEmailKeypair
   */
  function certifyEmailKeypair(email, keypair, onComplete, onFailure) {
    network.certKey(email, keypair.publicKey, issuer, allowUnverified,
        function(cert) {
      persistEmailKeypair(email, keypair, cert, onComplete, onFailure);
    }, onFailure);
  }


  function onContextChange(msg, context) {
    setAuthenticationStatus(context.auth_level, context.userid);
  }

  function withContext(onSuccess, onFailure) {
    network.withContext(onSuccess, onFailure);
  }

  function clearContext() {
    var und;
    userid = auth_status = und;
    network.clearContext();
  }

  function setAuthenticationStatus(auth_level, user_id) {
    if (window.$) {
      // TODO get this out of here!
      // jQuery is not included in the communication_iframe
      var func = !!auth_level ? 'addClass' : 'removeClass';
      $('body')[func]('authenticated');
    }

    auth_status = auth_level;
    userid = auth_level && user_id;

    // Keep the network.js copy of context up to date with any changes.
    // context should really be put into its own module so there is only
    // a single copy of it anywhere.
    network.setContext("auth_level", auth_level);
    network.setContext("userid", user_id);

    if (!!auth_status && userid) {
      // when session context returns with an authenticated user, update
      // localStorage to indicate we've seen this user on this device
      storage.usersComputer.setSeen(userid);
    }
    else {
      storage.clear();
    }
  }

  function handleAuthenticationResponse(email, type, onComplete,
      onFailure, status) {
    var authenticated = status.success;
    if (typeof authenticated !== 'boolean') {
      return onFailure("unexpected server response: " + authenticated);
    }

    setAuthenticationStatus(authenticated && type, status.userid);
    if (authenticated) {

      // The back end can suppress asking the user whether this is their
      // computer. This happens on FirefoxOS devices for now and may expand
      // in the future.
      if (status.suppress_ask_if_users_computer) {
        storage.usersComputer.setConfirmed(userid);
      }

      User.syncEmails(function() {
        complete(onComplete, authenticated);
      }, onFailure);
    } else {
      complete(onComplete, authenticated);
    }
  }

  User = {
    init: function(config) {
      config = config || {};
      mediator.subscribe('context_info', onContextChange);

      if (config.provisioning) {
        provisioning = config.provisioning;
      }

      // BEGIN TESTING API
      if (config.pollDuration) {
        pollDuration = config.pollDuration;
      }
      // END TESTING API

      if (config.issuer) {
        issuer = config.issuer;
      }
    },

    reset: function() {
      provisioning = BrowserID.Provisioning;
      User.resetCaches();
      registrationComplete = false;
      pollDuration = POLL_DURATION;
      stagedEmail = stagedPassword = userid = auth_status = null;
      issuer = "default";
      allowUnverified = false;
    },

    resetCaches: function() {
      addressCache = {};
      primaryAuthCache = {};
    },

    /**
     * Set the interface to use for networking.  Used for unit testing.
     * @method setNetwork
     * @param {BrowserID.Network} networkInterface - BrowserID.Network
     * compatible interface to use.
     */
    setNetwork: function(networkInterface) {
      network = networkInterface;
    },

    /**
     * setOrigin
     * @method setOrigin
     * @param {string} origin
     */
    setOrigin: function(originArg) {
      origin = originArg;
    },

    /**
     * Get the origin of the current host being signed in to.
     * @method getOrigin
     * @return {string} origin
     */
    getOrigin: function() {
      return origin;
    },

    setOriginEmail: function(email) {
      storage.site.set(origin, "email", email);
    },

    getOriginEmail: function() {
      return storage.site.get(origin, "email");
    },

    /**
     * Get the hostname for the set origin
     * @method getHostname
     * @returns {string}
     */
    getHostname: function() {
      return origin.replace(/^.*:\/\//, "").replace(/:\d*$/, "");
    },

    setReturnTo: function(returnTo) {
      this.returnTo = returnTo;
    },

    getReturnTo: function() {
      return this.returnTo;
    },

    setIssuer: function(forcedIssuer) {
      issuer = forcedIssuer;
    },

    getIssuer: function() {
      return issuer;
    },

    isDefaultIssuer: function() {
      return issuer === "default";
    },

    /**
     * Set whether the network should pass allowUnverified=true in
     * its requests.
     * @method setAllowUnverified
     * @param {boolean} [allow] - True or false, to allow.
     */
    setAllowUnverified: function(allow) {
      allowUnverified = allow;
    },

    /**
     * Return the user's userid, which will an integer if the user
     * is authenticated, undefined otherwise.
     *
     * @method userid
     */
    userid: function() {
      return userid;
    },

    withContext: withContext,
    clearContext: clearContext,

    /**
     * Create a user account - this creates an user account that must
     * be verified.
     * @method createSecondaryUser
     * @param {string} email
     * @param {string} password
     * @param {function} [onComplete] - Called on completion.
     * @param {function} [onFailure] - Called on error.
     */
    createSecondaryUser: function(email, password, onComplete, onFailure) {
      stageAddressVerification(email, password,
        network.createUser.bind(network, email, password,
            origin, allowUnverified), function(status) {
              // If creating an unverified account, the user will not go
              // through the verification flow while the dialog is open and the
              // cache will not be updated accordingly. Update the cache now.
              if (status.unverified) {
                var cachedAddress = addressCache[email];
                if (cachedAddress) {
                  cachedAddress.state = "unverified";
                }
              }
              complete(onComplete, status);
            }, onFailure);
    },

    /**
     * Create a primary user.
     * @method createPrimaryUser
     * @param {object} info
     * @param {function} onComplete - function to call on complettion.  Called
     * with two parameters - status and info.
     * Status can be:
     *  primary.already_added
     *  primary.verified
     *  primary.verify
     *  primary.could_not_add
     *
     *  info is passed on primary.verify and contains the info necessary to
     *  verify the user with the IdP
     */
    createPrimaryUser: function(info, onComplete, onFailure) {
      var email = info.email;
      User.provisionPrimaryUser(email, info, function(status, provInfo) {
        if (status === "primary.verified") {
          User.authenticateWithAssertion(email, provInfo.assertion, function(status) {
            if (status) {
              onComplete("primary.verified");
            }
            else {
              onComplete("primary.could_not_add");
            }
          }, onFailure);
        }
        else {
          onComplete(status, provInfo);
        }
      }, onFailure);
    },

    /**
     * A full provision a primary user, if they are authenticated, save their
     * cert/keypair.  Note, we do not authenticate to login.persona.org but
     * merely get an assertion for login.persona.org so that we can either add the
     * email to the current account or authenticate the user if not
     * authenticated.
     * @method provisionPrimaryUser
     * @param {string} email
     * @param {object} info - provisioning info
     * @param {function} [onComplete] - called when complete.  Called with
     * status field and info. Status can be:
     *  primary.already_added
     *  primary.verified
     *  primary.verify
     *  primary.could_not_add
     * @param {function} [onFailure] - called on failure
     */
    provisionPrimaryUser: function(email, info, onComplete, onFailure) {
      User.primaryUserAuthenticationInfo(email, info, function(authInfo) {
        if (authInfo.authenticated) {
          persistEmailKeypair(email, authInfo.keypair, authInfo.cert,
            function() {
              // We are getting an assertion for persona.org.
              User.getAssertion(email, "https://login.persona.org", function(assertion) {
                if (assertion) {
                  onComplete("primary.verified", {
                    assertion: assertion
                  });
                }
                else {
                  onComplete("primary.could_not_add");
                }
              }, onFailure);
            }
          );
        }
        else {
          onComplete("primary.verify", info);
        }
      }, onFailure);
    },

    /**
     * Get the IdP authentication info for a user.
     * @method primaryUserAuthenticationInfo
     * @param {string} email
     * @param {object} info - provisioning info
     * @param {function} [onComplete] - called when complete.  Called with
     * provisioning info as well as keypair, cert, and authenticated.
     *   authenticated - boolean, true if user is authenticated with primary.
     *    false otw.
     *   keypair - returned if user is authenticated.
     *   cert - returned if user is authenticated.
     * @param {function} [onFailure] - called on failure
     */
    primaryUserAuthenticationInfo: function(email, info, onComplete, onFailure) {
      var idInfo = storage.getEmail(email, issuer),
          self=this;

      primaryAuthCache = primaryAuthCache || {};

      function complete(info) {
        primaryAuthCache[email] = info;
        onComplete && _.defer(function() {
          onComplete(info);
        });
      }

      if (primaryAuthCache[email]) {
        // If we have the info in our cache, we most definitely do not have to
        // ask for it.
        return complete(primaryAuthCache[email]);
      }
      else if (idInfo && idInfo.cert) {
        // If we already have the info in storage, we know the user has a valid
        // cert with their IdP, we say they are authenticated and pass back the
        // appropriate info.
        var userInfo = _.extend({authenticated: true}, idInfo, info);
        return complete(userInfo);
      }

      provisioning(
        {
          email: email,
          url: info.prov,
          ephemeral: !storage.usersComputer.confirmed(email)
        },
        function(keypair, cert) {
          var userInfo = _.extend({
            keypair: keypair,
            cert: cert,
            authenticated: true
          }, info);

          complete(userInfo);
        },
        function(error) {
          // issue #2339 - in case an error is raised we don't care
          // about the specific error code.
          if (error.code === "primaryError") {
            var userInfo = _.extend({
              authenticated: false
            }, info);
            complete(userInfo);
          }
          else {
            onFailure($.extend(info, { action: { message: error }}));
          }
        }
      );
    },

    /**
     * Get the IdP authentication status for a user.
     * @method isUserAuthenticatedToPrimary
     * @param {string} email
     * @param {object} info - provisioning info
     * @param {function} [onComplete] - called when complete.  Called with
     *   status field - true if user authenticated with IdP, false otw.
     * @param {function} [onFailure] - called on failure
     */
    isUserAuthenticatedToPrimary: function(email, info, onComplete, onFailure) {
      User.primaryUserAuthenticationInfo(email, info, function(authInfo) {
        onComplete(authInfo.authenticated);
      }, onFailure);
    },

    /**
     * Poll the server until user registration is complete.
     * @method waitForUserValidation
     * @param {string} email - email address to check.
     * @param {function} [onSuccess] - Called to give status updates.
     * @param {function} [onFailure] - Called on error.
     */
    waitForUserValidation: addressVerificationPoll.curry(network.checkUserRegistration),

    /**
     * Cancel the waitForUserValidation poll
     * @method cancelUserValidation
     */
    cancelUserValidation: cancelRegistrationPoll,

    /**
     * Get site and email info for a token
     * @method tokenInfo
     * @param {string} token
     * @param {function} [onComplete]
     * @param {function} [onFailure]
     */
    tokenInfo: function(token, onComplete, onFailure) {
      network.emailForVerificationToken(token, function (info) {
        if (info) {
          info = _.extend(info, { returnTo: storage.getReturnTo() });
        }

        complete(onComplete, info);
      }, onFailure);

    },

    /**
     * Verify a user
     * @method verifyUser
     * @param {string} token - token to verify.
     * @param {string} password
     * @param {function} [onComplete] - Called on completion.
     *   Called with an object with valid, email, and origin if valid, called
     *   with valid=false otw.
     * @param {function} [onFailure] - Called on error.
     */
    verifyUser: completeAddressVerification.curry(network.completeUserRegistration),

    /**
     * Check if the user can set their password.  Only returns true for users
     * with secondary accounts
     * @method canSetPassword
     * @param {function} [onComplete] - Called on with boolean flag on
     * successful completion.
     * @param {function} [onFailure] - Called on error.
     */
    canSetPassword: function(onComplete, onFailure) {
      withContext(function(ctx) {
        complete(onComplete, ctx.has_password);
      }, onFailure);
    },

    /**
     * update the password of the current user.
     * @method changePassword
     * @param {string} oldpassword - the old password.
     * @param {string} newpassword - the new password.
     * @param {function} [onComplete] - called on completion.  Called with one
     * parameter, status - set to true if password update is successful, false
     * otw.
     * @param {function} [onFailure] - called on XHR failure.
     */
    changePassword: function(oldpassword, newpassword, onComplete, onFailure) {
      network.changePassword(oldpassword, newpassword, function(resp) {
        // successful change of password will upgrade a session to password
        // level auth
        if (resp.success) setAuthenticationStatus("password", userid);
        complete(onComplete, resp.success);
      }, onFailure);
    },

    /**
     * Request a password reset for the given email address.
     * @method requestPasswordReset
     * @param {string} email
     * @param {function} [onComplete] - Callback to call when complete, called
     * with a single object, info.
     *    info.status {boolean} - true or false whether request was successful.
     *    info.reason {string} - if status false, reason of failure.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    requestPasswordReset: function(email, onComplete, onFailure) {
      User.addressInfo(email, function(info) {
        // user is not known.  Can't request a password reset.
        if (info.state === "unknown") {
          complete(onComplete, { success: false, reason: "invalid_email" });
        }
        // user is trying to reset the password of a primary address.
        else if (info.type === "primary") {
          complete(onComplete, { success: false, reason: "primary_address" });
        }
        else {
          stageAddressVerification(email, null,
            network.requestPasswordReset.bind(network, email, origin),
            onComplete, onFailure);
        }
      }, onFailure);
    },

    /**
     * Verify the password reset for a user.
     * @method completePasswordReset
     * @param {string} token - token to verify.
     * @param {string} password
     * @param {function} [onComplete] - Called on completion.
     *   Called with an object with valid, email, and origin if valid, called
     *   with valid=false otw.
     * @param {function} [onFailure] - Called on error.
     */
    completePasswordReset: completeAddressVerification.curry(network.completePasswordReset),

    /**
     * Wait for the password reset to complete
     * @method waitForPasswordResetComplete
     * @param {string} email - email address to check.
     * @param {function} [onSuccess] - Called to give status updates.
     * @param {function} [onFailure] - Called on error.
     */
    waitForPasswordResetComplete: addressVerificationPoll.curry(network.checkPasswordReset),

    /**
     * Cancel the waitForPasswordResetComplete poll
     * @method cancelWaitForPasswordResetComplete
     */
    cancelWaitForPasswordResetComplete: cancelRegistrationPoll,

    /**
     * Request the reverification of an unverified email address
     * @method requestEmailReverify
     * @param {string} email
     * @param {function} [onComplete]
     * @param {function} [onFailure]
     */
    requestEmailReverify: function(email, onComplete, onFailure) {
      if (!storage.getEmail(email, issuer)) {
        // user does not own this address.
        complete(onComplete, { success: false, reason: "invalid_email" });
      }
      else {
        // try to reverify this address.
        stageAddressVerification(email, null,
          network.requestEmailReverify.bind(network, email, origin),
          onComplete, onFailure);
      }
    },

    // the verification page for reverifying an email and adding an email to an
    // account are the same, both are handled by the /confirm page. the
    // /confirm page uses the verifyEmail function.  completeEmailReverify is
    // not needed.

    /**
     * Wait for the email reverification to complete
     * @method waitForEmailReverifyComplete
     * @param {string} email - email address to check.
     * @param {function} [onSuccess] - Called to give status updates.
     * @param {function} [onFailure] - Called on error.
     */
    waitForEmailReverifyComplete: addressVerificationPoll.curry(network.checkEmailReverify),

    /**
     * Cancel the waitForEmailReverifyComplete poll
     * @method cancelWaitForEmailReverifyComplete
     */
    cancelWaitForEmailReverifyComplete: cancelRegistrationPoll,

    /**
     * Request a transition to secondary for the given email address.
     * @method requestTransitionToSecondary
     * @param {string} email
     * @param {string} password
     * @param {function} [onComplete] - Callback to call when complete, called
     * with a single object, info.
     *    info.status {boolean} - true or false whether request was successful.
     *    info.reason {string} - if status false, reason of failure.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    requestTransitionToSecondary: function(email, password, onComplete, onFailure) {
      User.addressInfo(email, function(info) {
        // user is not known.  Can't request a transition to secondary.
        if (info.state === "unknown") {
          complete(onComplete, { success: false, reason: "invalid_email" });
        }
        // user is trying to transition to a secondary for a primary address.
        else if (info.type === "primary") {
          complete(onComplete, { success: false, reason: "primary_address" });
        }
        else {
          stageAddressVerification(email, password,
            network.requestTransitionToSecondary.bind(network, email, password, origin),
            onComplete, onFailure);
        }
      }, onFailure);
    },

    /**
     * Verify the transition to secondary for a user.
     * @method completeTransitionToSecondary
     * @param {string} token - token to verify.
     * @param {string} password
     * @param {function} [onComplete] - Called on completion.
     *   Called with an object with valid, email, and origin if valid, called
     *   with valid=false otw.
     * @param {function} [onFailure] - Called on error.
     */
    completeTransitionToSecondary: completeAddressVerification.curry(network.completeTransitionToSecondary),

    /**
     * Wait for the transition to secondary to complete
     * @method waitForTransitionToSecondaryComplete
     * @param {string} email - email address to check.
     * @param {function} [onSuccess] - Called to give status updates.
     * @param {function} [onFailure] - Called on error.
     */
    waitForTransitionToSecondaryComplete: addressVerificationPoll.curry(network.checkTransitionToSecondary),

    /**
     * Cancel the waitForTransitionToSecondaryComplete poll
     * @method cancelWaitForTransitionToSecondaryComplete
     */
    cancelWaitForTransitionToSecondaryComplete: cancelRegistrationPoll,


    /**
     * Cancel the current user's account.  Remove last traces of their
     * identity.
     * @method cancelUser
     * @param {function} [onComplete] - Called whenever complete.
     * @param {function} [onFailure] - called on error.
     */
    cancelUser: function(onComplete, onFailure) {
      network.cancelUser(function() {
        setAuthenticationStatus(false);
        if (onComplete) {
          onComplete();
        }
      }, onFailure);

    },

    /**
     * Log the current user out.
     * @method logoutUser
     * @param {function} [onComplete] - Called whenever complete.
     * @param {function} [onFailure] - called on error.
     */
    logoutUser: function(onComplete, onFailure) {
      User.checkAuthentication(function(authenticated) {
        if (authenticated) {
          // logout of all websites
          storage.logoutEverywhere();

          // log out of browserid
          network.logout(function() {
            setAuthenticationStatus(false);
            complete(onComplete, !!authenticated);
          }, onFailure);
        }
        else {
          complete(onComplete, authenticated);
        }
      }, onFailure);
    },

    /**
     * Sync local identities with login.persona.org.  Generally should not need to
     * be called.
     * @method syncEmails
     * @param {function} [onComplete] - Called whenever complete.
     * @param {function} [onFailure] - Called on error.
     */
    syncEmails: function(onComplete, onFailure) {
      cleanupIdentities(function () {
        var issued_identities = User.getStoredEmailKeypairs();

        network.listEmails(function(server_emails) {
          // update our local storage map of email addresses to user ids
          if (userid) {
            storage.updateEmailToUserIDMapping(userid, server_emails);
          }

          // lists of emails
          var client_emails = _.keys(issued_identities);

          var emails_to_add_pair = [_.difference(server_emails, client_emails)];
          var emails_to_remove_pair = [_.difference(client_emails, server_emails)];
          var emails_to_update_pair = [_.intersection(client_emails, server_emails)];

          if (!User.isDefaultIssuer()) {
            var force_issuer_identities = storage.getEmails(issuer);
            var force_issuer_emails = _.keys(force_issuer_identities);
            emails_to_add_pair.push(_.difference(server_emails, force_issuer_emails));
            emails_to_remove_pair.push(_.difference(force_issuer_emails, server_emails));
            emails_to_update_pair.push(_.intersection(force_issuer_emails, server_emails));
          }

          // remove emails
          _.each(emails_to_remove_pair, function (emails_to_remove, i) {
            _.each(emails_to_remove, function(email) {
              if (0 === i)
                storage.removeEmail(email, "default");
              else
                storage.removeEmail(email, issuer);
            });
          });

          // these are new emails
          _.each(emails_to_add_pair, function(emails_to_add, i) {
            _.each(emails_to_add, function(email) {
              if (0 === i) {
                persistEmailWithoutKeypair({ email: email }, "default");
              } else {
                // issuer is always a secondary
                persistEmailWithoutKeypair({ email: email }, issuer);
              }
            });
          });
          complete(onComplete);
        }, onFailure);
      }, onFailure);
    },

    /**
     * Check whether the current user is authenticated.  Calls the callback
     * with false if cookies are disabled.
     * @method checkAuthentication
     * @param {function} [onComplete] - Called with user's auth level if
     * authenticated, false otw.
     * @param {function} [onFailure] - Called on error.
     */
    checkAuthentication: function(onComplete, onFailure) {
      network.cookiesEnabled(function(cookiesEnabled) {
        if (cookiesEnabled) {
          withContext(function() {
            complete(onComplete, auth_status || false);
          }, onFailure);
        }
        else {
          complete(onComplete, cookiesEnabled);
        }
      }, onFailure);
    },

    /**
     * Check whether the current user is authenticated.  If authenticated, sync
     * identities.
     * @method checkAuthenticationAndSync
     * @param {function} [onComplete] - Called on sync completion with one
     * boolean parameter, authenticated.  authenticated will be true if user
     * is authenticated, false otw.
     * @param {function} [onFailure] - Called on error.
     */
    checkAuthenticationAndSync: function(onComplete, onFailure) {
      User.checkAuthentication(function(authenticated) {
        if (authenticated) {
          User.syncEmails(function() {
            complete(onComplete, authenticated);
          }, onFailure);
        }
        else {
          complete(onComplete, authenticated);
        }
      }, onFailure);
    },

    /**
     * Authenticate the user with the given email and password.  This will sync
     * the user's addresses.
     * @method authenticate
     * @param {string} email - Email address to authenticate.
     * @param {string} password - Password.
     * @param {function} [onComplete] - Called on completion with status. true
     * if user is authenticated, false otw.
     * @param {function} [onFailure] - Called on error.
     */
    authenticate: function(email, password, onComplete, onFailure) {
      network.authenticate(email, password, allowUnverified,
          handleAuthenticationResponse.curry(email, "password", onComplete,
              onFailure), onFailure);
    },

    /**
     * Authenticate the user with the given email and assertion.  This will sync
     * the user's addresses.
     * @method authenticateWithAssertion
     * @param {string} email
     * @param {string} assertion
     * @param {function} [onComplete] - Called on completion with status. true
     * if user is authenticated, false otw.
     * @param {function} [onFailure] - Called on error.
     */
    authenticateWithAssertion: function(email, assertion, onComplete, onFailure) {
      network.authenticateWithAssertion(email, assertion,
          handleAuthenticationResponse.curry(email, "assertion", onComplete,
              onFailure), onFailure);

    },

    /**
     * Check whether the email is already registered.
     * @method isEmailRegistered
     * @param {string} email - Email address to check.
     * @param {function} [onComplete] - Called with one boolean parameter when
     * complete.  Parameter is true if `email` is already registered, false
     * otw.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    isEmailRegistered: function(email, onComplete, onFailure) {
      network.emailRegistered(email, onComplete, onFailure);
    },

    /**
     * Get information about an email address.  Who vouches for it?
     * (is it a primary or a secondary)
     * @method addressInfo
     * @param {string} email - Email address to check.
     * @param {function} [onComplete] - Called with an object on success,
     *   containing these properties:
     *     type: <secondary|primary>
     *     known: boolean, present if type is secondary.  True if email
     *        address is registered with BrowserID.
     *     authed: boolean, present if type is primary - whether the user
     *        is authenticated to the IdP as this user.
     *     auth: string - url to send users for auth - present if type is
     *        primary.
     *     prov: string - url to embed for silent provisioning - present
     *        if type is secondary.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    addressInfo: function(email, onComplete, onFailure) {
      function complete(info) {
        // key off of both the normalized email entered typed email so
        // that the cache is maximally effective.
        addressCache[email] = info;
        addressCache[info.email] = info;
        onComplete && onComplete(info);
      }

      if (addressCache[email]) {
        return complete(addressCache[email]);
      }

      network.addressInfo(email, issuer, function(info) {
        // update the email with the normalized email if it is available.
        // The normalized email is stored in the cache.
        var normalizedEmail = info.normalizedEmail || email;
        info.email = normalizedEmail;
        User.checkForInvalidCerts(normalizedEmail, info, function(cleanedInfo) {
          if (cleanedInfo.type === "primary") {
            withContext(function() {
              User.isUserAuthenticatedToPrimary(normalizedEmail, cleanedInfo,
                  function(authed) {
                cleanedInfo.authed = authed;
                cleanedInfo.idpName = _.escape(getIdPName(cleanedInfo));
                complete(cleanedInfo);
              }, onFailure);
            }, onFailure);
          }
          else {
            complete(cleanedInfo);
          }
        });
      }, onFailure);
    },

    /**
     * Checks for outdated certificates and clears them from storage.
     * Returns original info, may have been altered
     * @param {string} email - Email address to check.
     * @param {object} info - Output from addressInfo callback
     * @param {function} done - called with object when complete.
     */
    checkForInvalidCerts: function(email, info, done) {
      function clearCert(email, idInfo) {
        delete idInfo.cert;
        delete primaryAuthCache[email];
        storage.addEmail(email, idInfo);
      }

      var transitionStates = [
        "transition_to_secondary",
        "transition_no_password",
        "transition_to_primary"
      ];

      cryptoLoader.load(function(jwcrypto) {
        var record = User.getStoredEmailKeypair(email);

        if (!(record && record.cert)) return complete(done, info);

        var prevIssuer;
        try {
          prevIssuer =
              jwcrypto.extractComponents(record.cert).payload.iss;
        } catch (e) {
          // error parsing the certificate! Maybe it's of an
          // old/different format? clear cert.
          helpers.log("Looking for issuer, " +
              "error parsing cert for"+ email +":" + String(e));
          clearCert(email, record);
        }

        // If the address is vouched for by the fallback IdP, the issuer will
        // be the fallback IdP.
        if (info.issuer !== prevIssuer) {
          // issuer has changed... clear cert.
          clearCert(email, record);
        }
        else if (record.unverified && "unverified" !== info.state) {
          // cert was created with an unverified email but the email
          // is now verified... clear cert.
          clearCert(email, record);
        }
        else if (transitionStates.indexOf(info.state) > -1) {
          // On a transition, issuer MUST have changed... clear cert
          clearCert(email, record);
        }
        complete(done, info);
      });
    },

    /**
     * Add an email address to an already created account.  Sends address and
     * keypair to the server, user then needs to verify account ownership. This
     * does not add the new email address/keypair to the local list of
     * valid identities.
     * @method addEmail
     * @param {string} email
     * @param {string} password
     * @param {function} [onComplete] - Called on successful completion.
     * @param {function} [onFailure] - Called on error.
     */
    addEmail: function(email, password, onComplete, onFailure) {
      stageAddressVerification(email, password,
        network.addSecondaryEmail.bind(network, email, password, origin), onComplete, onFailure);
    },

    /**
     * Check whether a password is needed to add a secondary email address to
     * an already existing account.
     * @method passwordNeededToAddSecondaryEmail
     * @param {function} [onComplete] - Called on successful completion, called
     * with true if password is needed, false otw.
     * @param {function} [onFailure] - Called on error.
     */
    passwordNeededToAddSecondaryEmail: function(onComplete, onFailure) {
      withContext(function(ctx) {
        complete(onComplete, !ctx.has_password);
      }, onFailure);
    },

    /**
     * Wait for the email registration to complete
     * @method waitForEmailValidation
     * @param {string} email - email address to check.
     * @param {function} [onSuccess] - Called to give status updates.
     * @param {function} [onFailure] - Called on error.
     */
    waitForEmailValidation: addressVerificationPoll.curry(network.checkEmailRegistration),

    /**
     * Cancel the waitForEmailValidation poll
     * @method cancelEmailValidation
     */
    cancelEmailValidation: cancelRegistrationPoll,

    /**
     * Verify a users email address given by the token
     * @method verifyEmail
     * @param {string} token
     * @param {string} password
     * @param {function} [onComplete] - Called on completion.
     *   Called with an object with valid, email, and origin if valid, called
     *   with valid=false otw.
     * @param {function} [onFailure] - Called on error.
     */
    verifyEmail: completeAddressVerification.curry(network.completeEmailRegistration),

    /**
     * Remove an email address.
     * @method removeEmail
     * @param {string} email - Email address to remove.
     * @param {function} [onComplete] - Called when complete.
     * @param {function} [onFailure] - Called on error.
     */
    removeEmail: function(email, onComplete, onFailure) {
      if (storage.getEmail(email, issuer)) {
        network.removeEmail(email, function() {
          storage.removeEmail(email, issuer);
          complete(onComplete);
        }, onFailure);
      } else if (onComplete) {
        onComplete();
      }
    },

    /**
     * Sync an identity with the server.  Creates and stores locally and on the
     * server a keypair for the given email address.
     * @method syncEmailKeypair
     * @param {string} email - Email address.
     * @param {function} [onComplete] - Called on completion.  Called with
     * status parameter - true if successful, false otw.
     * @param {function} [onFailure] - Called on error.
     */
    syncEmailKeypair: function(email, onComplete, onFailure) {
      // jwcrypto depends on a random seed being set to generate a keypair.
      // The seed is set with a call to withContext.  Ensure the
      // random seed is set before continuing or else the seed may not be set,
      // the key never created, and the onComplete callback never called.
      withContext(function() {
        cryptoLoader.load(function(jwcrypto) {
          jwcrypto.generateKeypair({algorithm: "DS", keysize: bid.KEY_LENGTH}, function(err, keypair) {
            certifyEmailKeypair(email, keypair, onComplete, onFailure);
          });
        });
      });
    },


    /**
     * Get an assertion for an identity, optionally backed by a specific issuer
     * @method getAssertion
     * @param {string} email - Email to get assertion for.
     * @param {string} audience - Audience to use for the assertion.
     * @param {function} [onComplete] - Called with assertion, null otw.
     * @param {function} [onFailure] - Called on error.
     */
    getAssertion: function(email, audience, onComplete, onFailure) {
      var storedID = storage.getEmail(email, issuer),
          assertion,
          self=this;

      function createAssertion(idInfo) {
        // we use the current time from the browserid servers
        // to avoid issues with clock drift on user's machine.
        // (issue #329)
        network.serverTime(function(serverTime) {
          cryptoLoader.load(function(jwcrypto) {
            var sk = jwcrypto.loadSecretKeyFromObject(idInfo.priv);

            // assertions are valid for 2 minutes
            var expirationMS = serverTime.getTime() + (2 * 60 * 1000);
            var expirationDate = new Date(expirationMS);

            // yield to the render thread, important on IE8 so we don't
            // raise "script has become unresponsive" errors.
            setTimeout(function() {
              jwcrypto.assertion.sign(
                {}, {audience: audience, expiresAt: expirationDate},
                sk,
                function(err, signedAssertion) {
                  assertion = jwcrypto.cert.bundle([idInfo.cert], signedAssertion);
                  storage.site.set(audience, "email", email);
                  // issuer is used for B2G to get silent assertions to get
                  // assertions backed by certs from a special issuer.
                  storage.site.set(audience, "issuer", issuer);
                  complete(onComplete, assertion);
                });
            }, 0);
          });
        }, onFailure);
      }

      if (storedID) {
        if (storedID.priv) {
          // parse the secret key
          // yield to the render thread!
          setTimeout(function() {
            createAssertion(storedID);
          }, 0);
        }
        else {
          if (storedID.type === "primary" && User.isDefaultIssuer()) {
            // first we have to get the address info, then attempt
            // a provision, then if the user is provisioned, go and get an
            // assertion.
            User.addressInfo(email, function(info) {
              User.provisionPrimaryUser(email, info, function(status) {
                if (status === "primary.verified") {
                  User.getAssertion(email, audience, onComplete, onFailure);
                }
                else {
                  complete(onComplete, null);
                }
              }, onFailure);
            }, onFailure);
          }
          else {
            // we have no key for this identity, go generate the key,
            // sync it and then get the assertion recursively.
            User.syncEmailKeypair(email, function(status) {
              User.getAssertion(email, audience, onComplete, onFailure);
            }, onFailure);
          }
        }
      }
      else {
        complete(onComplete, null);
      }
    },

    /**
     * Get the list of identities stored locally.
     * @method getStoredEmailKeypairs
     * @return {object} identities.
     */
    getStoredEmailKeypairs: function() {
      return storage.getEmails(issuer);
    },

    /**
     * Get the list of identities sorted by address.
     * @method getSortedEmailKeypairs
     * @return {array} of objects, with two fields, address, data
     */
    getSortedEmailKeypairs: function() {
      var identities = User.getStoredEmailKeypairs(),
          sortedIdentities = [];

      for(var key in identities) {
        if (identities.hasOwnProperty(key)) {
          sortedIdentities.push({ address: key, info: identities[key] });
        }
      }

      sortedIdentities.sort(function(a, b) {
        var retval = a.address > b.address ? 1 : a.address < b.address ? -1 : 0;
        return retval;
      });

      return sortedIdentities;
    },

    /**
     * Get an individual stored identity.
     * @method getStoredEmailKeypair
     * @return {object} identity information for email, if exists, undefined
     * otw.
     */
    getStoredEmailKeypair: function(email) {
      return storage.getEmail(email, issuer);
    },

    /**
     * Clear the list of identities stored locally.
     * @method clearStoredEmailKeypairs
     */
    clearStoredEmailKeypairs: function() {
      storage.clear();
    },

    /**
     * Get an assertion for the current domain if the user is signed into it
     * @method getSilentAssertion
     * @param {function} onComplete - called on completion.  Called with an
     * an email and assertion if successful, null otw.
     * @param {function} onFailure - called on XHR failure.
     */
    getSilentAssertion: function(siteSpecifiedEmail, onComplete, onFailure) {
      User.checkAuthenticationAndSync(function(authenticated) {
        if (authenticated) {
          var loggedInEmail = storage.site.get(origin, "logged_in");
          if (loggedInEmail !== siteSpecifiedEmail) {
            if (loggedInEmail) {
              User.getAssertion(loggedInEmail, origin, function(assertion) {
                onComplete(assertion ? loggedInEmail : null, assertion);
              }, onFailure);
            } else {
              onComplete(null, null);
            }
          } else {
            onComplete(loggedInEmail, null);
          }
        }
        else if (onComplete) {
          onComplete(null, null);
        }
      }, onFailure);
    },

    /**
     * Clear the persistent signin field for the current origin
     * @method logout
     * @param {function} onComplete - called on completion.  Called with
     * a boolean, true if successful, false otw.
     * @param {function} onFailure - called on XHR failure.
     */
    logout: function(onComplete, onFailure) {
      User.checkAuthentication(function(authenticated) {
        if (authenticated) {
          storage.site.remove(origin, "logged_in");
        }

        if (onComplete) {
          onComplete(!!authenticated);
        }
      }, onFailure);
    },

    /**
     * Set whether the user owns the computer or not.
     * @method setComputerOwnershipStatus
     * @param {boolean} userOwnsComputer - true if user owns computer, false otw.
     * @param {function} onComplete - called on successful completion.
     * @param {function} onFailure - called on XHR failure.
     */
    setComputerOwnershipStatus: function(userOwnsComputer, onComplete, onFailure) {
      withContext(function() {
        if (typeof userid !== "undefined") {
          if (userOwnsComputer) {
            storage.usersComputer.setConfirmed(userid);
            network.prolongSession(onComplete, onFailure);
          }
          else {
            storage.usersComputer.setDenied(userid);
            complete(onComplete);
          }
        } else {
          complete(onFailure, "user is not authenticated");
        }
      }, onFailure);
    },

    /**
     * Check if the user owns the computer
     * @method isUsersComputer
     */
    isUsersComputer: function(onComplete, onFailure) {
      withContext(function() {
        if (typeof userid !== "undefined") {
          complete(onComplete, storage.usersComputer.confirmed(userid));
        } else {
          complete(onFailure, "user is not authenticated");
        }
      }, onFailure);
    },

    /**
     * Check whether the user should be asked if this is their computer
     * @method shouldAskIfUsersComputer
     */
    shouldAskIfUsersComputer: function(onComplete, onFailure) {
      withContext(function() {
        if (typeof userid !== "undefined") {
          // A user should never be asked if they completed an email
          // registration/validation in this dialog session.
          var shouldAsk = storage.usersComputer.shouldAsk(userid)
                          && !registrationComplete;
          complete(onComplete, shouldAsk);
        } else {
          complete(onFailure, "user is not authenticated");
        }
      }, onFailure);
    },

    /**
     * Mark the transition state of this user as having been completed.
     * @method usedAddressAsPrimary
     */
    usedAddressAsPrimary: function(email, onComplete, onFailure) {
      User.checkAuthentication(function(authenticated) {
        if (authenticated) {
          network.usedAddressAsPrimary(email, onComplete, onFailure);
        }
        else complete(onFailure, "user is not authenticated");
      }, onFailure);
    }
  };

  // Set origin to default to the current domain.  Other contexts that use user.js,
  // like dialogs or iframes, will call setOrigin themselves to update this to
  // the origin of the of the RP.  On login.persona.org, it will remain the origin of
  // login.persona.org
  var currentOrigin = window.location.protocol + '//' + window.location.hostname;
  if (window.location.port) {
    currentOrigin += ':' + window.location.port;
  }
  User.setOrigin(currentOrigin);
  return User;
}());
