#!/usr/bin/env node

const assert = require('assert'),
      vows = require('vows'),
      fs = require('fs'),
      path = require('path'),
      http = require('http'),
      querystring = require('querystring'),
      start_stop = require('./lib/start-stop.js'),
      wsapi = require('./lib/wsapi.js');

const amMain = (process.argv[1] === __filename);

var suite = vows.describe('forgotten-email');

start_stop.addStartupBatches(suite);

// let's kludge our way into nodemailer to intercept outbound emails
var lastEmailBody = undefined;
const nodeMailer = require('nodemailer');
nodeMailer.EmailMessage.prototype.send = function(callback) {
  lastEmailBody = this.body;
};

// a global variable that will be populated with the latest verification
// token
var token = undefined;

// create a new account via the api with (first address)
suite.addBatch({
  "stage first account": {
    topic: wsapi.get('/wsapi/stage_user', {
      email: 'first@fakeemail.com',
      pass: 'firstfakepass',
      pubkey: 'fakepubkey',
      site:'fakesite.com'
    }),
    "caused an email to be sent": function (r, err) {
      assert.equal(r.code, 200);
      var m = /token=([a-zA-Z0-9]+)/.exec(lastEmailBody);
      token = m[1];
    },
    "the token is sane": function(r, err) {
      assert.strictEqual('string', typeof token);
    }
  }
});

suite.addBatch({
  "create first account": {
    topic: function() {
      wsapi.get('/wsapi/prove_email_ownership', { token: token }).call(this);
    },
    "account created": function(r, err) {
      assert.equal(r.code, 200);
    }
  }
});

suite.addBatch({
  "email created": {
    topic: wsapi.get('/wsapi/registration_status'),
    "should exist": function(r, err) {
      assert.strictEqual(r.code, 200);
      assert.strictEqual(JSON.parse(r.body), "complete");
    }
  }
});

// add a new email address to the account (second address)
suite.addBatch({
  "add a new email address to our account": {
    topic: wsapi.get('/wsapi/add_email', {
      email: 'second@fakeemail.com',
      pubkey: 'fakepubkey',
      site:'fakesite.com'
    }),
    "caused an email to be sent": function (r, err) {
      assert.equal(r.code, 200);
      var m = /token=([a-zA-Z0-9]+)/.exec(lastEmailBody);
      token = m[1];
    },
    "the token is sane": function(r, err) {
      assert.strictEqual('string', typeof token);
    }
  }
});

// confirm second email email address to the account
suite.addBatch({
  "create second account": {
    topic: function() {
      wsapi.get('/wsapi/prove_email_ownership', { token: token }).call(this);
    },
    "account created": function(r, err) {
      assert.equal(r.code, 200);
    }
  }
});

// verify now both email addresses are known
suite.addBatch({
  "first email exists": {
    topic: wsapi.get('/wsapi/have_email', { email: 'first@fakeemail.com' }),
    "should exist": function(r, err) {
      assert.strictEqual(true, JSON.parse(r.body));
    }
  },
  "second email exists": {
    topic: wsapi.get('/wsapi/have_email', { email: 'second@fakeemail.com' }),
    "should exist": function(r, err) {
      assert.strictEqual(JSON.parse(r.body), true);
    }
  },
  "a random email doesn't exist": {
    topic: wsapi.get('/wsapi/have_email', { email: 'third@fakeemail.com' }),
    "shouldn't exist": function(r, err) {
      assert.strictEqual(JSON.parse(r.body), false);
    }
  }
});

// Run the "forgot_email" flow with first address.  This is really
// just re-registering the user.
suite.addBatch({
  "re-stage first account": {
    topic: wsapi.get('/wsapi/stage_user', {
      email: 'first@fakeemail.com',
      pass: 'secondfakepass',
      pubkey: 'fakepubkey2',
      site:'otherfakesite.com'
    }),
    "caused an email to be sent": function (r, err) {
      assert.equal(r.code, 200);
      var m = /token=([a-zA-Z0-9]+)/.exec(lastEmailBody);
      token = m[1];
    },
    "the token is sane": function(r, err) {
      assert.strictEqual('string', typeof token);
    }
  }
});

// verify that the old email address + password combinations are still
// valid (this is so *until* someone clicks through)
suite.addBatch({
  "first email works": {
    topic: wsapi.get('/wsapi/authenticate_user', { email: 'first@fakeemail.com', pass: 'firstfakepass' }),
    "should work": function(r, err) {
      assert.strictEqual(true, JSON.parse(r.body));
    }
  },
  "second email works": {
    topic: wsapi.get('/wsapi/authenticate_user', { email: 'second@fakeemail.com', pass: 'firstfakepass' }),
    "should work": function(r, err) {
      assert.strictEqual(true, JSON.parse(r.body));
    }
  }
});

// now let's complete the re-registration of first email address
suite.addBatch({
  "re-create first email address": {
    topic: function() {
      wsapi.get('/wsapi/prove_email_ownership', { token: token }).call(this);
    },
    "account created": function(r, err) {
      assert.equal(r.code, 200);
    }
  }
});

// now we should be able to log into the first email address with the second
// password, and all other combinations should fail
suite.addBatch({
  "first email, first pass bad": {
    topic: wsapi.get('/wsapi/authenticate_user', { email: 'first@fakeemail.com', pass: 'firstfakepass' }),
    "shouldn't work": function(r, err) {
      assert.strictEqual(JSON.parse(r.body), false);
    }
  },
  "first email, second pass good": {
    topic: wsapi.get('/wsapi/authenticate_user', { email: 'first@fakeemail.com', pass: 'secondfakepass' }),
    "should work": function(r, err) {
      assert.strictEqual(JSON.parse(r.body), true);
    }
  },
  "second email, first pass good": {
    topic: wsapi.get('/wsapi/authenticate_user', { email: 'second@fakeemail.com', pass: 'firstfakepass' }),
    "should work": function(r, err) {
      assert.strictEqual(JSON.parse(r.body), true);
    }
  },
  "second email, second pass bad": {
    topic: wsapi.get('/wsapi/authenticate_user', { email: 'second@fakeemail.com', pass: 'secondfakepass' }),
    "shouldn' work": function(r, err) {
      assert.strictEqual(JSON.parse(r.body), false);
    }
  },
});

start_stop.addShutdownBatches(suite);

suite.run();
