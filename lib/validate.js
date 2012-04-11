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
httputils = require('./httputils.js');

module.exports = function (params) {
  return function(req, resp, next) {
    var params_in_request=null;
    if (req.method === "POST") {
      params_in_request = req.body;
    } else {
      params_in_request = req.query;
    }

    try {
      params.forEach(function(k) {
        if (!params_in_request || !params_in_request.hasOwnProperty(k) || typeof params_in_request[k] !== 'string') {
          throw k;
        }
      });
    } catch(e) {
      var msg = "missing '" + e + "' argument";
      logger.warn("bad request received: " + msg);
      return httputils.badRequest(resp, msg);
    }

    // this is called outside the try/catch because errors
    // in the handling of the request should be caught separately
    next();
  };
};
