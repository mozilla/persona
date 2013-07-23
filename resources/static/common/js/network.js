/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
BrowserID.Network = (function() {
  "use strict";
  /*globals require:true*/

  var bid = BrowserID,
      helpers = bid.Helpers,
      complete = helpers.complete,
      context,
      mediator = bid.Mediator,
      XHR = bid.Modules.XHR,
      xhr,
      // XXX get this out of here!
      storage = bid.Storage;

  function post(options) {
    if (!context) {
      // If there is no context, go fetch it and then call this function
      // recursively.
      return withContext(post.curry(options), options.error);
    }

    options.data = options.data || {};
    options.data.csrf = context.csrf_token;
    xhr.post(options);
  }

  function get(options) {
    xhr.get(options);
  }

  function withContext(done, onFailure) {
    if (context) return complete(done, context);

    // session_context always checks for a javascript readable cookie,
    // this allows our javascript code in the dialog and communication iframe
    // to determine whether cookies are (partially) disabled.  See #2999 for
    // more context.
    // NOTE - the cookie is set here instead of cookiesEnabled because
    // session_context is only ever called once per context session. We have
    // to ensure the cookie is set for that single call.
    try {
      document.cookie = "can_set_cookies=1";
    } catch(e) {
      // If cookies are disabled, some browsers throw an exception. Ignore
      // this, the backend will see that cookies are disabled.
    }

    get({
      url: "/wsapi/session_context",
      success: function(result) {
        setContext(result);
        complete(done, context);
      },
      error: onFailure
    });
  }

  function setContext(newContext) {
    context = _.extend({}, newContext, {
      local_time: new Date().getTime()
    });

    mediator.publish("context_info", context);
  }

  function clearContext() {
    var undef;
    context = undef;
  }

  function stageAddressForVerification(data, wsapiName, onComplete, onFailure) {
    post({
      url: wsapiName,
      data: data,
      success: function(info) {
        if (info.success) complete(onComplete, info);
        else complete(onComplete, false);
      },
      error: function(info) {
        // 429 is throttling.
        if (info.network.status === 429) {
          complete(onComplete, false);
        }
        else complete(onFailure, info);
      }
    });
  }

  function completeAddressVerification(wsapiName, token, password, onComplete, onFailure) {
      var data = {
        token: token
      };

      // Only send the password along if it was actually given
      if (password !== null) data.pass = password;

      post({
        url: wsapiName,
        data: data,
        success: onComplete,
        error: onFailure
      });

    }

  var Network = {
    /**
     * Initialize - Clear all context info. Used for testing.
     * @method init
     */
    init: function(config) {
      config = config || {};

      if (config.xhr) {
        xhr = config.xhr;
      } else {
        xhr = XHR.create();
        xhr.init({ time_until_delay: bid.XHR_DELAY_MS });
      }

      // BEGIN TEST API
      this.cookiesEnabledOverride = config && config.cookiesEnabledOverride;
      // END TEST API

      clearContext();
    },

    /**
     * Authenticate the current user
     * @method authenticate
     * @param {string} email - address to authenticate
     * @param {string} password - password.
     * @param {function} [onComplete] - callback to call when complete.  Called
     * with status parameter - true if authenticated, false otw.
     * @param {function} [onFailure] - called on XHR failure
     */
    authenticate: function(email, password, allowUnverified,
        onComplete, onFailure) {
      post({
        url: "/wsapi/authenticate_user",
        data: {
          email: email,
          pass: password,
          ephemeral: !storage.usersComputer.confirmed(email),
          allowUnverified: allowUnverified
        },
        success: onComplete,
        error: onFailure
      });
    },

    /**
     * Authenticate with a primary generated assertion
     * @method authenticateWithAssertion
     * @param {string} email - address to authenticate
     * @param {string} assertion
     * @param {function} [onComplete] - callback to call when complete.  Called
     * with status parameter - true if authenticated, false otw.
     * @param {function} [onFailure] - called on XHR failure
     */
    authenticateWithAssertion: function(email, assertion, onComplete, onFailure) {
      post({
        url: "/wsapi/auth_with_assertion",
        data: {
          assertion: assertion,
          ephemeral: !storage.usersComputer.confirmed(email)
        },
        success: onComplete,
        error: onFailure
      });
    },

    withContext: withContext,

    setContext: function(field, value) {
      if (arguments.length === 1) {
        if (!helpers.isObject(field)) throw new Error("invalid context");

        // an object was passed in for the context. Used for testing.
        setContext(field);
      }
      else {
        if (context) context[field] = value;
      }
    },

    /**
     * clear local cache, including authentication status and
     * other session data.
     *
     * @method clearContext
     */
    clearContext: clearContext,

    /**
     * Log the authenticated user out
     * @method logout
     * @param {function} [onComplete] - called on completion
     * @param {function} [onFailure] - Called on XHR failure.
     */
    logout: function(onComplete, onFailure) {
      post({
        url: "/wsapi/logout",
        success: onComplete,
        error: function(info, xhr, textStatus) {
          if (info.network.status === 400) {
            complete(onComplete);
          }
          else {
            complete(onFailure, info);
          }
        }
      });
    },

    /**
     * Create a new user.  Requires a user to verify identity.
     * @method createUser
     * @param {string} email
     * @param {string} password
     * @param {string} origin - site user is trying to sign in to.
     * @param {boolean} allowUnverified
     * @param {function} [onComplete] - Callback to call when complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    createUser: function(email, password, origin, allowUnverified,
        onComplete, onFailure) {
      var postData = {
        email: email,
        pass: password,
        site : origin,
        allowUnverified: allowUnverified
      };
      stageAddressForVerification(postData, "/wsapi/stage_user", onComplete, onFailure);
    },

    /**
     * Check the email address associated with a verification token
     * @method emailForVerificationToken
     * @param {string} token - Token to check
     *
     * TODO: think about whether this requires the right cookie
     * I think so (BA).
     */
    emailForVerificationToken: function(token, onComplete, onFailure) {
      get({
        url : "/wsapi/email_for_token?token=" + encodeURIComponent(token),
        success: function(result) {
          var data = null;
          if(result.success !== false) {
            // force needs_password to be set;
            data = _.extend({ needs_password: false }, result);
          }
          complete(onComplete, data);
        },
        error: onFailure
      });
    },

    /**
     * Check the current user"s registration status
     * @method checkUserRegistration
     * @param {function} [onComplete] - Called when complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    checkUserRegistration: function(email, onComplete, onFailure) {
      get({
        url: "/wsapi/user_creation_status?email=" + encodeURIComponent(email),
        success: onComplete,
        error: onFailure
      });
    },

    /**
     * Complete user registration, give user a password
     * @method completeUserRegistration
     * @param {string} token - token to register for.
     * @param {string} password
     * @param {function} [onComplete] - Called when complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    completeUserRegistration: completeAddressVerification.curry("/wsapi/complete_user_creation"),

    /**
     * Call with a token to prove an email address ownership.
     * @method completeEmailRegistration
     * @param {string} token - token proving email ownership.
     * @param {string} password
     * @param {function} [onComplete] - Callback to call when complete.  Called
     * with one boolean parameter that specifies the validity of the token.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    completeEmailRegistration: completeAddressVerification.curry("/wsapi/complete_email_confirmation"),

    /**
     * Request a password reset for the given email address.
     * @method requestPasswordReset
     * @param {string} email
     * @param {string} origin
     * @param {function} [onComplete] - Callback to call when complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    requestPasswordReset: function(email, origin, onComplete, onFailure) {
      var postData = {
        email: email,
        site : origin
      };
      stageAddressForVerification(postData, "/wsapi/stage_reset", onComplete, onFailure);
    },

    /**
     * Complete email reset password
     * @method completePasswordReset
     * @param {string} token - token to register for.
     * @param {string} password
     * @param {function} [onComplete] - Called when complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    completePasswordReset: completeAddressVerification.curry("/wsapi/complete_reset"),

    /**
     * Check the registration status of a password reset
     * @method checkPasswordReset
     * @param {function} [onsuccess] - called when complete.
     * @param {function} [onfailure] - called on xhr failure.
     */
    checkPasswordReset: function(email, onComplete, onFailure) {
      get({
        url: "/wsapi/password_reset_status?email=" + encodeURIComponent(email),
        success: onComplete,
        error: onFailure
      });
    },

    /**
     * Stage an email reverification.
     * @method requestEmailReverify
     * @param {string} email
     * @param {string} origin - site user is trying to sign in to.
     * @param {function} [onComplete] - Callback to call when complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    requestEmailReverify: function(email, origin, onComplete, onFailure) {
      var postData = {
        email: email,
        site : origin
      };
      stageAddressForVerification(postData, "/wsapi/stage_reverify", onComplete, onFailure);
    },

    // the verification page for reverifying an email and adding an email to an
    // account are the same, both are handled by the /confirm page. the
    // /confirm page uses the verifyEmail function.  completeEmailReverify is
    // not needed.

    /**
     * Check the registration status of an email reverification
     * @method checkEmailReverify
     * @param {function} [onsuccess] - called when complete.
     * @param {function} [onfailure] - called on xhr failure.
     */
    checkEmailReverify: function(email, onComplete, onFailure) {
      get({
        url: "/wsapi/email_reverify_status?email=" + encodeURIComponent(email),
        success: onComplete,
        error: onFailure
      });
    },

    /**
     * post interaction data
     * @method setPassword
     * @param {string} password - new password.
     * @param {function} [onComplete] - Callback to call when complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    sendInteractionData: function(data, onComplete, onFailure) {
      post({
        url: "/wsapi/interaction_data",
        data: {
          // reminder, CSRF token will be inserted here by xhr.js, that's
          // why this *must* be an object
          data: data
        },
        success: function(status) {
          complete(onComplete, status.success);
        },
        error: onFailure
      });
    },

    /**
     * Update the password of the current user
     * @method changePassword
     * @param {string} oldpassword - old password.
     * @param {string} newpassword - new password.
     * @param {function} [onComplete] - Callback to call when complete. Will be
     * called with true if successful, false otw.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    changePassword: function(oldPassword, newPassword, onComplete, onFailure) {
      post({
        url: "/wsapi/update_password",
        data: {
          oldpass: oldPassword,
          newpass: newPassword
        },
        success: onComplete,
        error: onFailure
      });
    },


    /**
     * Cancel the current user"s account.
     * @method cancelUser
     * @param {function} [onComplete] - called whenever complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    cancelUser: function(onComplete, onFailure) {
      post({
        url: "/wsapi/account_cancel",
        success: onComplete,
        error: onFailure
      });
    },

    /**
     * Add an email to the current user's account using an assertion.
     * @method addEmailWithAssertion
     * @param {string} assertion - assertion used to add user.
     * @param {function} [onComplete] - called when complete.
     * @param {function} [onFailure] - called on XHR failure.
     */
    addEmailWithAssertion: function(assertion, onComplete, onFailure) {
      post({
        url: "/wsapi/add_email_with_assertion",
        data: {
          assertion: assertion
        },
        success: function(status) {
          complete(onComplete, status.success);
        },
        error: onFailure
      });
    },

    /**
     * Add a secondary email to the current user's account.
     * @method addSecondaryEmail
     * @param {string} email
     * @param {string} password
     * @param {string} origin
     * @param {function} [onComplete] - called when complete.
     * @param {function} [onFailure] - called on xhr failure.
     */
    addSecondaryEmail: function(email, password, origin, onComplete, onFailure) {
      var postData = {
        email: email,
        pass: password,
        site : origin
      };
      stageAddressForVerification(postData, "/wsapi/stage_email", onComplete, onFailure);
    },

    /**
     * Check the registration status of an email
     * @method checkEmailRegistration
     * @param {function} [onsuccess] - called when complete.
     * @param {function} [onfailure] - called on xhr failure.
     */
    checkEmailRegistration: function(email, onComplete, onFailure) {
      get({
        url: "/wsapi/email_addition_status?email=" + encodeURIComponent(email),
        success: onComplete,
        error: onFailure
      });
    },

    /**
     * Check whether the email is already registered.
     * @method emailRegistered
     * @param {string} email - Email address to check.
     * @param {function} [onComplete] - Called with one boolean parameter when
     * complete.  Parameter is true if `email` is already registered, false
     * otw.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    emailRegistered: function(email, onComplete, onFailure) {
      get({
        url: "/wsapi/have_email?email=" + encodeURIComponent(email),
        success: function(data, textStatus, xhr) {
          complete(onComplete, data.email_known);
        },
        error: onFailure
      });
    },

    /**
     * Get information about an email address.  Who vouches for it?
     * (is it a primary or a secondary)
     * @method addressInfo
     * @param {string} email - Email address to check.
     * @param {string} issuer - Force a specific Issuer by specifing a domain. null for default.
     * @param {function} [onComplete] - Called with an object on success,
     *   containing these properties:
     *     type: <secondary|primary>
     *     known: boolean, present - present if type is secondary
     *     auth: string - url to send users for auth - present if type is primary
     *     prov: string - url to embed for silent provisioning - present if type is secondary
     * @param {function} [onFailure] - Called on XHR failure.
     */
    addressInfo: function(email, issuer, onComplete, onFailure) {
      issuer = issuer || 'default';
      get({
        url: "/wsapi/address_info?email=" + encodeURIComponent(email) +
             "&issuer=" + encodeURIComponent(issuer),
        success: function(data, textStatus, xhr) {
          complete(onComplete, data);
        },
        error: onFailure
      });
    },

    /**
     * Remove an email address from the current user.
     * @method removeEmail
     * @param {string} email - Email address to remove.
     * @param {function} [onComplete] - Called whenever complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    removeEmail: function(email, onComplete, onFailure) {
      post({
        url: "/wsapi/remove_email",
        data: {
          email: email
        },
        success: function(status, textStatus, jqXHR) {
          complete(onComplete, status.success);
        },
        error: onFailure
      });
    },

    /**
     * Certify the public key for the email address.
     * @method certKey
     */
    certKey: function(email, pubkey, forceIssuer, allowUnverified,
        onComplete, onFailure) {
      var postData = {
        email: email,
        pubkey: pubkey.serialize(),
        ephemeral: !storage.usersComputer.confirmed(email),
        allowUnverified: allowUnverified
      };

      if (forceIssuer !== "default") {
        postData.forceIssuer = forceIssuer;
      }

      post({
        url: "/wsapi/cert_key",
        data: postData,
        success: onComplete,
        error: onFailure
      });
    },

    /**
     * List emails
     * @method listEmails
     */
    listEmails: function(onComplete, onFailure) {
      get({
        url: "/wsapi/list_emails",
        success: function(emails) {
          complete(onComplete, emails.emails);
        },
        error: onFailure
      });
    },

    /**
     * Get the current time on the server in the form of a
     * date object.
     *
     * Note: this function will perform a network request if
     * during this session /wsapi/session_context has not
     * been called.
     *
     * @method serverTime
     */
    serverTime: function(onComplete, onFailure) {
      withContext(function(context) {
        var server_time = context.server_time;
        try {
          if (!server_time) throw new Error("can't get server time!");
          var offset = (new Date()).getTime() - context.local_time;
          complete(onComplete, new Date(offset + server_time));
        } catch(e) {
          complete(onFailure, String(e));
        }
      }, onFailure);
    },

    /**
     * Get the time at which the domain key was last updated.
     *
     * Note: this function will perform a network request if
     * during this session /wsapi/session_context has not
     * been called.
     *
     * @method domainKeyCreationTime
     */
    domainKeyCreationTime: function(onComplete, onFailure) {
      withContext(function(context) {
        var domain_key_creation_time = context.domain_key_creation_time;
        try {
          if (!domain_key_creation_time) throw new Error("can't get domain key creation time!");
          complete(onComplete, new Date(domain_key_creation_time));
        } catch(e) {
          complete(onFailure, String(e));
        }
      }, onFailure);
    },

    /**
     * Get the most recent code version
     *
     * Note: this function will perform a network request if
     * during this session /wsapi/session_context has not
     * been called.
     *
     * @method codeVersion
     */
    codeVersion: function(onComplete, onFailure) {
      withContext(function(context) {
        complete(onComplete, context.code_version);
      }, onFailure);
    },

    /**
     * Check if the user's cookies are enabled
     * @method cookiesEnabled
     */
    cookiesEnabled: function(onComplete, onFailure) {
      withContext(function(context) {
        // session_context always checks for a javascript readable cookie,
        // this allows our javascript code in the dialog and communication
        // iframe to determine whether cookies are (partially) disabled.
        // See #2999 for more context.
        var enabled = context.cookies;

        // BEGIN TESTING API
        if (typeof Network.cookiesEnabledOverride === "boolean") {
          enabled = Network.cookiesEnabledOverride;
        }
        // END TESTING API

        complete(onComplete, enabled);
      }, onFailure);
    },

    /**
     * Prolong a user's session so that they are not re-prompted to enter their
     * password
     * @method prolongSession
     * @param {function} [onComplete] - Called whenever complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    prolongSession: function(onComplete, onFailure) {
      post({
        url: "/wsapi/prolong_session",
        success: onComplete,
        error: onFailure
      });
    },

    /**
     * Mark the transition of this email as having been completed.
     * @method usedAddressAsPrimary
     * @param {string} [email] - The email that transitioned.
     * @param {function} [onComplete] - Called whenever complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    usedAddressAsPrimary: function(email, onComplete, onFailure) {
      post({
        url: "/wsapi/used_address_as_primary",
        data: { email: email },
        success: onComplete,
        error: onFailure
      });
    },

    /**
     * Request that an account transitions from a primary to a secondary. Used
     * whenever a user has only primary addresses and one of the addresses
     * belongs to an IdP which converts to a secondary.
     * @method requestTransitionToSecondary
     * @param {string} email
     * @param {string} password
     * @param {string} origin - site user is trying to sign in to.
     * @param {function} [onComplete] - Callback to call when complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    requestTransitionToSecondary: function(email, password, origin, onComplete, onFailure) {
      var postData = {
        email: email,
        pass: password,
        site : origin
      };
      stageAddressForVerification(postData, "/wsapi/stage_transition", onComplete, onFailure);
    },

    /**
     * Complete transition to secondary
     * @method completeTransitionToSecondary
     * @param {string} token - token to register for.
     * @param {string} password
     * @param {function} [onComplete] - Called when complete.
     * @param {function} [onFailure] - Called on XHR failure.
     */
    completeTransitionToSecondary: completeAddressVerification.curry("/wsapi/complete_transition"),

    /**
     * Check the registration status of a transition to secondary
     * @method checkTransitionToSecondary
     * @param {function} [onsuccess] - called when complete.
     * @param {function} [onfailure] - called on xhr failure.
     */
    checkTransitionToSecondary: function(email, onComplete, onFailure) {
      get({
        url: "/wsapi/transition_status?email=" + encodeURIComponent(email),
        success: onComplete,
        error: onFailure
      });
    }
  };

  return Network;

}());
