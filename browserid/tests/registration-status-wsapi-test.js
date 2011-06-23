#!/usr/bin/env node

const assert = require('assert'),
      vows = require('vows'),
      start_stop = require('./lib/start-stop.js'),
      wsapi = require('./lib/wsapi.js'),
      interceptor = require('./lib/email-interceptor.js');

var suite = vows.describe('registration-status-wsapi');

// ever time a new token is sent out, let's update the global
// var 'token'
var token = undefined;
interceptor.onEmail = function(newtok) { token = newtok; }

// start up a pristine server
start_stop.addStartupBatches(suite);

suite.addBatch({
  "calling registration_status without a pending reg is an error": {
    topic: wsapi.get("/wsapi/registration_status"),
    "HTTP 400": function (r, err) {
      assert.equal(400, r.code);
    }
  }
});

// now start a registration
suite.addBatch({
  "start registration": {
    topic: wsapi.get('/wsapi/stage_user', {
      email: 'first@fakeemail.com',
      pass: 'firstfakepass',
      pubkey: 'fakepubkey',
      site:'fakesite.com'
    }),
    "the token is sane": function(r, err) {
      assert.strictEqual('string', typeof token);
    }
  }
});

suite.addBatch({
  "calling registration_status when a reg is really pending": {
    topic: wsapi.get("/wsapi/registration_status"),
    "yields a HTTP 200": function (r, err) {
      assert.strictEqual(r.code, 200);
    },
    "returns a json encoded string - `pending`": function (r, err) {
      assert.strictEqual(JSON.parse(r.body), "pending");
    }
  }
});

suite.addBatch({
  "proving email ownership causes account creation": {
    topic: function() {
      wsapi.get('/wsapi/prove_email_ownership', { token: token }).call(this);
    },
    "and returns a 200 code": function(r, err) {
      assert.equal(r.code, 200);
    }
  }
});

suite.addBatch({
  "calling registration_status after a registration is complete": {
    topic: wsapi.get("/wsapi/registration_status"),
    "yields a HTTP 200": function (r, err) {
      assert.strictEqual(r.code, 200);
    },
    "returns a json encoded string - `complete`": function (r, err) {
      assert.strictEqual(JSON.parse(r.body), "complete");
    }
  }
});

suite.addBatch({
  "calling registration_status a second time after a registration is complete": {
    topic: wsapi.get("/wsapi/registration_status"),
    "yields a HTTP 400, it's meaningless": function (r, err) {
      assert.strictEqual(r.code, 400);
    }
  }
});

suite.addBatch({
  "after successful registration": {
    topic: wsapi.get("/wsapi/am_authed"),
    "we're authenticated": function (r, err) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(JSON.parse(r.body), true);
    },
    "but we can easily clear cookies on the client to change that!": function(r, err) {
      wsapi.clearCookies();
    }
  }
});

suite.addBatch({
  "after clearing cookies": {
    topic: wsapi.get("/wsapi/am_authed"),
    "we're NOT authenticated": function (r, err) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(JSON.parse(r.body), false);
    }
  }
});

suite.addBatch({
  "re-registering an existing email": {
    topic: wsapi.get('/wsapi/stage_user', {
      email: 'first@fakeemail.com',
      pass: 'secondfakepass',
      pubkey: 'secondfakepubkey',
      site:'secondfakesite.com'
    }),
    "yields a valid token": function(r, err) {
      assert.strictEqual('string', typeof token);
    }
  }
});

suite.addBatch({
  "calling registration_status when a reg is pending for an email that is already verified": {
    topic: wsapi.get("/wsapi/registration_status"),
    "should yield a HTTP 200": function (r, err) {
      assert.strictEqual(r.code, 200);
    },
    "returns a json encoded string - `pending`": function (r, err) {
      assert.strictEqual(JSON.parse(r.body), "pending");
    }
  }
});

suite.addBatch({
  "proving email ownership causes account creation": {
    topic: function() {
      wsapi.get('/wsapi/prove_email_ownership', { token: token }).call(this);
    },
    "and returns a 200 code": function(r, err) {
      assert.equal(r.code, 200);
    }
  }
});

suite.addBatch({
  "calling registration_status after proving a re-registration": {
    topic: wsapi.get("/wsapi/registration_status"),
    "yields a HTTP 200": function (r, err) {
      assert.strictEqual(r.code, 200);
    },
    "returns a json encoded string - `complete`": function (r, err) {
      assert.strictEqual(JSON.parse(r.body), "complete");
    }
  }
});

suite.addBatch({
  "again, calling registration_status a second time after a registration is complete": {
    topic: wsapi.get("/wsapi/registration_status"),
    "yields a HTTP 400, it's meaningless": function (r, err) {
      assert.strictEqual(r.code, 400);
    }
  }
});

suite.addBatch({
  "after re-registration, authenticating with new credetials": {
    topic: wsapi.get('/wsapi/authenticate_user', { email: 'first@fakeemail.com', pass: 'secondfakepass' }),
    "works as you might expect": function (r, err) {
      assert.strictEqual(true, JSON.parse(r.body));
    }
  }
});

// shut the server down and cleanup
start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
