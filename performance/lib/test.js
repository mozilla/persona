const
wcli = require("../../libs/wsapi_client.js"),
userdb = require("./user_db.js");

// lets create a user!

// and a configuration (what server we're talking to)
var cfg = { browserid: 'http://127.0.0.1:10002' }

// and a user
var user = userdb.getNewUser();
userdb.addKeyToUserCtx(user.ctxs[0]);

// now start the dance with a call to stage_user
wcli.post(cfg, '/wsapi/stage_user', user.ctxs[0], {
  email: user.emails[0],
  pass: user.password,
  pubkey: user.ctxs[0].keys[0].pub,
  site: user.sites[0]
}, function (r) {
  // now get the verification secret
  wcli.get(cfg, '/wsapi/fake_verification', user.ctxs[0], {
    email: user.emails[0]
  }, function (r) {
    wcli.get(cfg, '/wsapi/prove_email_ownership', user.ctxs[0], {
      token: r.body
    }, function (r) {
      console.log(r.body);
    });
  });
});
