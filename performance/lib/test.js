const wcli = require("./wsapi_client.js");

// lets create a user!

// we'll need a cookie jar (client context)
var ctx = {};

// and a configuration (what server we're talking to)
var cfg = { browserid: 'http://127.0.0.1:10002' }

// now start the dance with a call to stage_user
wcli.post(cfg, '/wsapi/stage_user', ctx, {
  email: 'first@fakeemail.com',
  pass: 'firstfakepass',
  pubkey: 'fakepubkey',
  site:'fakesite.com'
}, function (r) {
  console.log(r.body);
});
