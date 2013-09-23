/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * A thin abstraction layer to provice cef functionality.
 *
 * This is deliberately not a part of the logging.js library because
 * we want CEF logging calls to stand out separately in the code.
 *
 * See the cef module's README.md file for more information.
 */

const path = require('path'),
      http = require('http'),
      cef = require('cef'),
      logger = require('./logging').logger;

var Logger = function(options) {
  this.cef = cef.getInstance(options);
};

/**
 * The CEF logger supports eight logging severities.  In practice, we
 * use only four:
 *
 *   emergency: Completely out of whack. Someone needs to look at
 *              this. Harm to the application, user account, or system
 *              security could have taken place.
 *
 *   alert:     Suspicious activity or application has non-validated
 *              user input. Impact is not known.
 *
 *   warn:      Normal security application stuff, login failures,
 *              password changes.
 *
 *   info:      Normal app activity. Logins and various kinds of
 *              transactions.
 */

Logger.prototype = {

  /**
   * _emit() - an private method to map the logging methods below
   * to the cef logger methods.
   */
  _emit: function(severity, signature, name, extensions) {
    extensions = extensions || {};
    var options = {
      signature: signature,
      name: name,
      extensions: extensions || {}
    };

    logger.info('cef.' + name, options);
    return this.cef[severity](options);
  },

  /**
   * The following logging functions take these arguments:
   *
   * @param signature
   *        (integer)    A short string describing the part of the
   *                     application that is being logged.  Used by
   *                     ArcSight for correlation.  Yes, this is
   *                     annoying and awkward to have to enter.
   *
   * @param name
   *        (string)     A human-readable description.  This is your log
   *                     message.
   *
   * @param etc ...
   *        (objects)    A set of positional arguments containing key/value
   *                     pairs to be logged as extensions.  You can pass
   *                     dictionaries of valid CEF keys or http request
   *                     objects.  The latter will be converted into valid
   *                     CEF keys.  These arguments will all be mashed into
   *                     a single dictionary of CEF extensions.  Arguments
   *                     will be processed in the order they are given.
   */

  emergency: function(signature, name) {
    var extensions = mergeObjects([].slice.call(arguments, 2));
    return this._emit('emergency', signature, name, extensions);
  },

  alert: function(signature, name) {
    var extensions = mergeObjects([].slice.call(arguments, 2));
    return this._emit('alert', signature, name, extensions);
  },

  warn: function(signature, name) {
    var extensions = mergeObjects([].slice.call(arguments, 2));
    return this._emit('warn', signature, name, extensions);
  },

  info: function(signature, name) {
    var extensions = mergeObjects([].slice.call(arguments, 2));
    return this._emit('info', signature, name, extensions);
  }
};

/**
 * getInstance()     get a singleton instance of the logger with the
 *                   config specified in our configuration.js file.
 */
var instances = {};
module.exports.getInstance = function getInstance(config) {
  // maybe override app config
  config = config || require('../configuration').get('cef');

  // make an instance key for this config
  var configKey = [];
  Object.keys(config).sort().forEach(function(key) {
    configKey.push(key + '=' + config[key]);
  });
  // stringify the array
  configKey = configKey.join(',');

  if (!instances[configKey]) {
    instances[configKey] = new Logger(config);
  }

  return instances[configKey];
};

function copyIntoObject(to, from) {
  Object.keys(from).forEach(function(key) {
    to[key] = from[key];
  });
}

/**
 * mergeObjects - utility function for logging methods below.
 * It combines a list of objects into a single CEF extension
 * dictionary.
 *
 * Presently, objects can be either an http request or a
 * plain ol' dictionary.
 */
function mergeObjects(objList) {
  var obj = {};
  for (var i = 0; i < objList.length; i++) {
    // http request objects: extract relevant objects
    if (objList[i] instanceof http.IncomingMessage) {
      copyIntoObject(obj, cef.extensionsFromHTTPRequest(objList[i]));
    }
    // Assume everything else is just valid cef extensions
    else {
      copyIntoObject(obj, objList[i]);
    }
  }
  return obj;
}


