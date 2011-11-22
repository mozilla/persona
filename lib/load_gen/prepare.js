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
      { email: email, pass: user.password },
      function(r) {
        if (JSON.parse(r.body).success !== true) return cb("failed to authenticate");
        ctx.session.authenticated = true;
        cb();
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
          pubkey: keypair.publicKey.serialize()
        }, function(resp) {
          if (typeof resp.body !== 'string') return cb("can't certify key");
          userdb.addCertToUserCtx(ctx, email, resp.body);
          cb();
        });
    }
  };

  exports.auth(cfg, user, ctx, email, function(err) {
    if (err) return cb(err);
    genKey(cb);
  });
};

exports.genAssertionAndVerify = function(cfg, user, ctx, email, audience, cb) {
  var serverTime = new Date(ctx.session.server_time);
  wcli.get(cfg, '/wsapi/list_emails', ctx, undefined, function (r) {
    // just verify that we got a JSON object, we don't care about
    // the contents so much
    try {
      if (!typeof JSON.parse(r.body) === 'object') throw 'bogus response';
    } catch(e) {
      return cb(e.toString());
    }

    var assertion = crypto.getAssertion({
      now: serverTime,
      secretKey: ctx.keys[email].keyPair.secretKey,
      cert: ctx.keys[email].cert,
      audience: audience,
      email: email
    });

    wcli.post(cfg, '/verify', {}, {
      audience: audience,
      assertion: assertion
    }, function (r) {
      try {
        cb(JSON.parse(r.body).status === 'okay' ? undefined : "verification failed");
      } catch(e) {
        return cb("response body: " + r.body + " error: " + e.toString());
      }
    });
  });
}

