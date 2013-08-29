/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// a teensy tinsy module to do parameter validation.  A good candiate for future
// librification.
//
// usage:
//
//   const validate = require('validate.js');
//
//   app.post('/wsapi/foo', validate([ "email", "site" ]), function(req, resp) {
//   });

const
logger = require('./logging.js').logger,
httputils = require('./httputils.js'),
check = require('validator').check,
url = require('url');

var hostnameRegex = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$|^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/;

var types = {
  email: function(x) {
    check(x).isEmail();
  },
  email_type: function(x) {
    check(x).isIn([ 'primary', 'secondary' ]);
  },
  userid: function(x) {
    check(x).isInt();
  },
  password: function(x) {
    check(x).len(8,80);
  },
  boolean: function(x) {
    if (typeof x !== 'boolean') throw "boolean required";
  },
  token: function(x) {
    check(x).len(48,48).isAlphanumeric();
  },
  assertion: function(x) {
    check(x).len(50,10240).regex(/[0-9a-zA-Z~_\-]+/);
  },
  pubkey: function(x) {
    check(x).len(50,10240);
    JSON.parse(x);
  },
  hostname: function(x) {
    check(x).is(hostnameRegex);
  },
  origin: function(x) {
    /* origin regex
    /^                          // beginning
    (?:https?|app):\/\/         // starts with http://, https://, or app:// (b2g desktop)
    (?=.{1,254}(?::|$))         // hostname must be within 1-254 characters
    (?:                         // match hostname part (<part>.<part>...)
      (?!-)                     // cannot start with a dash (allow it to start with a digit re issue #2042)
      (?![a-z0-9\-]{1,62}-      // part cannot end with a dash
        (?:\.|:|$))             // (end of part will be '.', ':', or end of str)
      [a-z0-9\-]{1,63}\b        // part will be 1-63 letters, numbers, or dashes
        (?!\.$)                 // final part cannot end with a '.'
        \.?                     // part followed by '.' unless final part
    )+                          // one or more hostname parts
    (:\d+)?                     // optional port
    $/i;                        // end; case-insensitive
    */
    var regex = /^(?:https?|app):\/\/(?=.{1,254}(?::|$))(?:(?!-)(?![a-z0-9\-]{1,62}-(?:\.|:|$))[a-z0-9\-]{1,63}\b(?!\.$)\.?)+(:\d+)?$/i;
    if (typeof x !== 'string' || !x.match(regex)) {
      throw new Error("not a valid origin");
    }
  },
  color: function(value) {
    if (value.substr(0, 1) === '#') {
      value = value.substr(1);
    }

    // Check if this is valid hex color
    if (!value.match(/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/)) {
      throw new Error('not a valid color: ' + value);
    }
  },
  image: function(inputLogoUri) {
    var dataMatches = null; // is this a valid data URI?
    // Ideally we'd be loading this from a canonical constants library.
    var imageMimeTypes = ['png', 'gif', 'jpg', 'jpeg', 'svg'];
    // This regex converts valid input of the form:
    //   'data:image/png;base64,iV...'
    // into an array that looks like:
    //   ['data:image/png;base64,iV...', 'image', 'png', ...]
    // which means that mimetype proper is represented as-> [1]/[2]
    var dataUriRegex = /^data:(.+)\/(.+);base64,(.*)$/;

    dataMatches = inputLogoUri.match(dataUriRegex);
    if (dataMatches) {
      if ((dataMatches[1].toLowerCase() === 'image')
           &&
          (imageMimeTypes.indexOf(dataMatches[2].toLowerCase()) > -1)) {
        return;
      }
      throw new Error("Bad data URI for siteLogo: " + inputLogoUri.slice(0, 15) + " ...");
    }

    // Regularize URL; throws error if input is relative.
    /*jshint newcap:false*/
    if (url.parse(inputLogoUri).protocol !== 'https:') {
      throw new Error("siteLogos can only be served from https and data schemes.");
    }
  }
};

module.exports = function (params) {
  // normalize the parameters description, verify all specified types are present
  if (Array.isArray(params) || typeof params !== 'object' || typeof params === null) {
    throw "argument to validate must be an object, not a " + (typeof params);
  }

  Object.keys(params).forEach(function(p) {
    var v = params[p];
    if (typeof v === 'string') {
      v = { type: v };
    }
    if (typeof v.required === "undefined") v.required = true;

    if (!types[v.type]) throw "unknown type specified in WSAPI:" + v.type;
    params[p] = v;
  });

  return function(req, resp, next) {
    var reqParams = null;
    if (req.method === "POST") {
      reqParams = req.body;
    } else {
      reqParams = req.query;
    }

    // clear body and query to prevent wsapi handlers from accessing
    // un-validated input parameters
    req.body = {};
    req.query = {};
    req.params = {};

    // now validate
    try {
      // allow csrf through
      if (reqParams.csrf) {
        req.params.csrf = reqParams.csrf;
        delete reqParams.csrf;
      }

      Object.keys(params).forEach(function(p) {
        if (params[p].required && !reqParams.hasOwnProperty(p)) throw "missing required parameter: '" + p + "'";
        if (reqParams[p] === undefined) return;

        // validate
        try {
          types[params[p].type](reqParams[p]);
        } catch (e) {
          throw p + ": " + e.toString();
        }
        req.params[p] = reqParams[p];
        delete reqParams[p];
      });

      // if there are any keys left in reqParams, they're not allowable!
      var extra = Object.keys(reqParams);
      if (extra.length) throw "extra parameters are not allowed: " + extra.join(', ');
    } catch(e) {
      var msg = {
        success: false,
        reason: e.toString()
      };
      logger.warn("bad request received: " + msg.reason);
      resp.statusCode = 400;
      return resp.json(msg);
    }


    // this is called outside the try/catch because errors
    // in the handling of the request should be caught separately
    next();
  };
};
