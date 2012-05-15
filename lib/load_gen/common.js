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
        try {
          if (err) throw err;
          if (JSON.parse(r.body).success !== true) {
            throw "non-success response " + r.code + (r.body ? (" - " + r.body) : "");
          }
          ctx.session.authenticated = true;
          cb();
        } catch (e) {
          cb("can't authenticate: " + e);
        }
      }
    );
  }
};

exports.authAndKey = function(cfg, user, ctx, email, cb) {
  function genKey(cb) {
    if (ctx.keys && ctx.keys[email]) {
      cb();
    } else {
      var keypair = userdb.addKeyToUserCtx(ctx, email);
        // and now let's certify the pubkey
        wcli.post(cfg, '/wsapi/cert_key', ctx, {
          email: email,
          pubkey: keypair.publicKey.serialize(),
          ephemeral: false
        }, function(err, resp) {
          try {
            if (err) throw err;
            if (resp.code !== 200) throw "non-200 status: " + resp.code +
              + " - " + resp.body;
            if (typeof resp.body !== 'string') throw cb("no response body");
            userdb.addCertToUserCtx(ctx, email, resp.body);
            cb();
          } catch(e) {
            cb("can't certify key" + (e ? (": " + e.toString()) : ""));
          }
        });
    }
  };

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
    // just verify that we got a JSON object, we don't care about
    // the contents so much
    try {
      if (err) throw err;
      if (!typeof JSON.parse(r.body) === 'object') throw 'bogus response';
    } catch(e) {
      return cb(e.toString() + (r ? (" - " + r.body) : ""));
    }

    crypto.getAssertion({
      now: t,
      secretKey: ctx.keys[email].keyPair.secretKey,
      cert: ctx.keys[email].cert,
      audience: audience,
      email: email
    }, function(err, assertion) {
      if (err) {
        return cb("error getting assertion: " + err);
      }

      wcli.post(cfg, '/verify', {}, {
        audience: assertion.audience,
        assertion: assertion.assertion
      }, function (err, r) {
        try {
          if (err) throw err;
          if (r.code !== 200) throw "non-200 status: " + resp.code;
          if (!JSON.parse(r.body).status === 'okay') throw "verification failed with: " + r.reason;
          cb(undefined);
        } catch(e) {
          return cb("can't verify: " + e.toString());
        }
      });
    });
  });
};

