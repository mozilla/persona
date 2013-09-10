/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// some common procedures.

const
wcli = require("../wsapi_client.js"),
userdb = require("./user_db.js"),
crypto = require("./crypto.js");

exports.auth = function(cfg, user, ctx, email, cb) {
  if (ctx.session && ctx.session.authenticated) {
    cb();
  } else {
    wcli.post(
      cfg, '/wsapi/authenticate_user', ctx,
      { email: email, pass: user.password, ephemeral: false },
      function(err, r) {
        err = exports.checkResponse(err, r);
        if (err) return cb(err);
        if (r.body.success !== true) {
          return cb(new LoadGenError("failed to auth user: " + email, null, r));
        }
        ctx.session.authenticated = true;
        cb();
      }
    );
  }
};

exports.authAndKey = function(cfg, user, ctx, email, cb) {
  function genKey(cb) {
    if (ctx.keys && ctx.keys[email] && ctx.keys[email].cert) {
      cb();
    } else {
      var keypair = userdb.addKeyToUserCtx(ctx, email);

      // and now let's certify the pubkey
      wcli.post(cfg, '/wsapi/cert_key', ctx, {
        email: email,
        pubkey: keypair.publicKey.serialize(),
        ephemeral: false
      }, function(err, resp) {
        err = exports.checkResponse(err, resp);
        // response is not expected to be json
        if (err && err.code !== 'nonJSON') return cb(err);
        userdb.addCertToUserCtx(ctx, email, resp.body);
        cb();
      });
    }
  }

  exports.auth(cfg, user, ctx, email, function(err) {
    if (err) return cb(err);
    genKey(cb);
  });
};

exports.genAssertionAndVerify = function(cfg, user, ctx, email, audience, cb) {
  // assume server time is different from local time, and simulate what
  // the web client does (calculates local delta from session creation time, and
  // adds that to server time)
  var t = new Date(((new Date()).getTime() - ctx.sessionStartedAt) + ctx.session.server_time);

  wcli.get(cfg, '/wsapi/list_emails', ctx, undefined, function (err, r) {
    err = exports.checkResponse(err, r);
    if (err) return cb(err);

    if (!ctx.keys[email].cert) console.log(">>", email, ctx.keys[email]);
    crypto.getAssertion({
      now: t,
      secretKey: ctx.keys[email].keyPair.secretKey,
      cert: ctx.keys[email].cert,
      audience: audience,
      email: email
    }, function(err, assertion) {
      if (err) return cb(new LoadGenError("error getting assertion: " + err));

      wcli.post(cfg, '/verify', {}, {
        audience: assertion.audience,
        assertion: assertion.assertion
      }, function (err, r) {
        err = exports.checkResponse(err, r);
        if (err) return cb(err);
        if (r.body.status !== 'okay') {
          return cb(new LoadGenError("verification failed", null, r));
        }
        cb(null);
      });
    });
  });
};

function LoadGenError(message, code, details) {
  this.name = "LoadGenError";
  this.message = message || "Default Message";
  this.code = code || "unknown";
  if (details) this.details = details;
}

LoadGenError.prototype = new Error();
LoadGenError.prototype.constructor = LoadGenError;

LoadGenError.prototype.toString = function() {
  var str = this.code + ": " + this.message;
  if (this.details) {
    var clone = JSON.parse(JSON.stringify(this.details));
    delete clone.headers; // TMI, usually
    str += " >>> " + JSON.stringify(clone);
  }
  return str;
};

exports.error = function(message, code, details) {
  return new LoadGenError(message, code, details);
};

// check an error parameter and http response for an error
exports.checkResponse = function(err, resp) {
  if (err) return new LoadGenError(err);
  if (!resp) return new LoadGenError("null http response object");

  var e;
  if (resp.code === 503) {
    e = new LoadGenError("too busy", "serverTooBusy", resp);
  } else if (resp.code !== 200) {
    e = new LoadGenError("non 200 response code", "responseNotOk", resp);
  } else if (!resp.body) {
    e = new LoadGenError("null response body", null, resp);
  }

  // no error so far?  let's parse the response body
  if (!e) {
    try {
      resp.body = JSON.parse(resp.body);
    } catch(exc) {
      e = new LoadGenError("non-json response body", "nonJSON", resp);
    }
  }

  return e;
};
