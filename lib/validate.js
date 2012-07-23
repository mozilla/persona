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
check = require('validator').check;

var types = {
  email: function(x) {
    check(x).isEmail();
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
    check(x).len(50,10240).regex(/[0-9a-zA-Z~_-]+/);
  },
  pubkey: function(x) {
    check(x).len(50,10240);
    JSON.parse(x);
  },
  origin: function(x) {
    /* origin regex
    /^                          // beginning
    https?:\/\/                 // starts with http:// or https://
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
    var regex = /^https?:\/\/(?=.{1,254}(?::|$))(?:(?!-)(?![a-z0-9\-]{1,62}-(?:\.|:|$))[a-z0-9\-]{1,63}\b(?!\.$)\.?)+(:\d+)?$/i;
    if (typeof x !== 'string' || !x.match(regex)) {
      throw new Error("not a valid origin");
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
