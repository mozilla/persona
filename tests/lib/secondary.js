var start_stop = require('./start-stop.js'),
wsapi = require('./wsapi.js'),
wcli = require('../../lib/wsapi_client.js'),
jwcrypto = require("jwcrypto");

// create a new account via the api with (first address)
exports.create = function(opts, cb) {
  opts = opts || {};
  opts.email = opts.email || 'testuser@example.com';
  opts.password = opts.password || opts.pass || 'password';
  opts.site = opts.site || 'http://rp.example.com';
  opts.fetchVerificationLinkCallback = opts.fetchVerificationLinkCallback || start_stop.waitForToken;

  wcli.post(wsapi.configuration, '/wsapi/stage_user', wsapi.context, {
    email: opts.email,
    pass:  opts.password,
    site:  opts.site
  }, function(err, r) {
    if (err) return cb("cannot stage: " + err);
    if (r.code !== 200) return cb("cannot stage: " + r.body);

    opts.fetchVerificationLinkCallback(opts.email, function(err, t) {
      if (err) return cb("no verification token could be fetched: " + err);
      wcli.post(wsapi.configuration, '/wsapi/complete_user_creation', wsapi.context, {
        token: t
      }, function(err, r) {
        if (err) return cb("cannot complete: " + err);
        if (r.code !== 200) return cb("cannot complete: " + r.body);
        cb(err, r);
      });
    });
  });
};
