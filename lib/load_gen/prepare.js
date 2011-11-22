// the common steps required to "prepare" an identity for use inside
// a simulated browser context live here.  This includes:
//
//  1. authenticating if requried
//  2. generating a keypair if required
//  3. certifying that keypair
//  4. storing all this crap on the session.

const
wcli = require("../wsapi_client.js"),
userdb = require("./user_db.js");

module.exports = function(cfg, user, ctx, email, cb) {
  function doAuth(lcb) {
    if (ctx.session && ctx.session.authenticated) {
      lcb();
    } else {
      wcli.post(
        cfg, '/wsapi/authenticate_user', ctx,
        { email: email, pass: user.password },
        function(r) {
          if (JSON.parse(r.body).success !== true) return cb("failed to authenticate");
          ctx.session.authenticated = true;
          lcb();
        }
      );
    }
  };

  function genKey(lcb) {
    if (ctx.keys && ctx.keys[email]) {
      lcb();
    } else {
      var keypair = userdb.addKeyToUserCtx(ctx, email);
        // and now let's certify the pubkey
        wcli.post(cfg, '/wsapi/cert_key', ctx, {
          email: email,
          pubkey: keypair.publicKey.serialize()
        }, function(resp) {
          if (typeof resp.body !== 'string') return cb("can't certify key");
          userdb.addCertToUserCtx(ctx, email, resp.body);
          lcb();
        });
    }
  };

  doAuth(function() {
    genKey(function() {
      // all done!
      cb();
    });
  });
};