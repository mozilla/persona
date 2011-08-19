const
wcli = require("./wsapi_client.js"),
userdb = require("./user_db.js");

// lets create a user!

// we'll need a cookie jar (client context)
var ctx = {};

// and a configuration (what server we're talking to)
var cfg = { browserid: 'http://127.0.0.1:10002' }

// and a user
var user = userdb.getNewUser();
userdb.addKeyToUser(user);

// now start the dance with a call to stage_user
wcli.post(cfg, '/wsapi/stage_user', ctx, {
  email: user.emails[0],
  pass: user.password,
  pubkey: user.pubkeys[0],
  site: user.sites[0]
}, function (r) {
  // now get the verification secret
  wcli.get(cfg, '/wsapi/fake_verification', ctx, {
    email: user.emails[0]
  }, function (r) {
    wcli.get(cfg, '/wsapi/prove_email_ownership', ctx, {
      token: r.body
    }, function (r) {
      console.log(r.body);
    });
  });
});
