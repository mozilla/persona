/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
  "use strict";

  var bid = BrowserID,
      dom = bid.DOM,
      validation = bid.Validation,
      helpers = bid.Helpers = bid.Helpers || {};

  function getAndValidateEmail(target) {
    var email = (dom.getInner(target) || "").trim();

    if(!validation.email(email)) return null;

    return email;
  }

  function getAndValidatePassword(target) {
    var password = (dom.getInner(target) || "");

    if(!validation.password(password)) return null;

    return password;
  }

  function toURL(base, params) {
    var url = base,
        getParams = [];

    for(var key in params) {
      getParams.push(key + "=" + encodeURIComponent(params[key]));
    }

    if(getParams.length) {
      url += "?" + getParams.join("&");
    }

    return url;
  }

  function whitelistFilter(obj, validKeys) {
    var filtered = {};
    _.each(_.keys(obj), function(key) {
      if (_.indexOf(validKeys, key) !== -1) {
        filtered[key] = obj[key];
      }
    });
    return filtered;
  }

  function cancelEvent(callback) {
    return function(event) {
      event && event.preventDefault();
      callback.call(this);
    };
  }

  function complete(callback) {
    if(callback) {
      var args = [].slice.call(arguments, 1);
      callback.apply(null, args);
    }
  }

  function log() {
    try {
      var msg = "";
      var args = [].slice.call(arguments, 0);
      _.each(args, function(arg, index) {
        if (index > 0) msg += ", ";

        if (helpers.isString(arg)) {
          msg += arg;
        }
        else if (helpers.isObject(arg)) {
          try {
            msg += JSON.stringify(arg, null, 2);
          } catch(err) {
            // could be recursive
            msg += "<<object>>";
          }
        }
        else if (helpers.isFunction(arg)) {
          msg += "<<function>>";
        }
        else {
          msg += String(arg);
        }
      });
      window.console.log(msg);
    } catch(e) {
      // Catch all if console is not available or if it for some reason blows
      // up. Do nothing.
    }
  }

  var emailRe = /.*@/;
  function getDomainFromEmail(email) {
    return String(email).replace(emailRe, "");
  }

  function redirect(win, returnTo) {
    win.location = decodeURI(returnTo);
  }

  _.extend(helpers, {
    isObject: function(arg) {
      return Object.prototype.toString.apply(arg) === "[object Object]";
    },

    isString: function(arg) {
      return Object.prototype.toString.apply(arg) === "[object String]";
    },

    isFunction: function(arg) {
      return Object.prototype.toString.apply(arg) === "[object Function]";
    },

    isArray: function(arg) {
      return Object.prototype.toString.apply(arg) === "[object Array]";
    },

    isNull: function(arg) {
      return arg === null;
    },

    isUndefined: function(arg) {
      return (typeof arg === 'undefined');
    },

    /**
     * Get an email from a DOM element and validate it.
     * @method getAndValidateEmail
     * @param {string} target - target containing the email
     * @return {string} email if email is valid, null otw.
     */
    getAndValidateEmail: getAndValidateEmail,

    /**
     * Get an password from a DOM element and validate it.
     * @method getAndValidatePassword
     * @param {string} target - target containing the password
     * @return {string} password if password is valid, null otw.
     */
    getAndValidatePassword: getAndValidatePassword,

    /**
     * Convert a base URL and an object to a URL with GET parameters.  All
     * keys/values are converted as <key>=encodeURIComponent(<value>)
     * method @toURL
     * @param {string} base_url - base url
     * @param {object} [params] - object to convert to GET parameters.
     * @returns {string}
     */
    toURL: toURL,

    /**
     * Filter an object by a whitelist of keys, returning a new object.
     * @param {object} obj - the object to filter
     * @param {object} [validKeys] - whitelisted keys
     */
    whitelistFilter: whitelistFilter,

    /**
     * Return a function that calls preventDefault on the event and then calls
     * the callback with the arguments.
     * @method cancelEvent
     * @param {function} function to call after the event is cancelled.
     */
    cancelEvent: cancelEvent,
    /**
     * @method complete
     * @param {function} [callback] - callback to call.  Only called if
     * parameter is a function.
     * @param {variant} [params] - parameters to pass to callback.
     */
    complete: complete,

    /**
     * If the console is available, log a message to it.
     * @method log
     * @param {string} msg
     */
    log: log,

    getDomainFromEmail: getDomainFromEmail,

    /**
     * Since we always encode returnTo, we need to decode it before
     * redirecting the page. Using this helper makes sure we always
     * decode first.
     * @method redirect
     * @param {window} win
     * @param {string} returnTo
     */
    redirect: redirect
  });


}());

