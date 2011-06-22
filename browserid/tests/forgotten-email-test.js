#!/usr/bin/env node

const assert = require('assert'),
      vows = require('vows'),
      fs = require('fs'),
      path = require('path'),
      http = require('http'),
      querystring = require('querystring');

const amMain = (process.argv[1] === __filename);
const varPath = path.join(path.dirname(__dirname), "var");

var suite = vows.describe('forgotten-email');

function removeVarDir() {
  try {
    fs.readdirSync(varPath).forEach(function(f) {
        fs.unlinkSync(path.join(varPath, f));
    });
    fs.rmdirSync(varPath);
  } catch(e) {}
}

// wsapi abstractions trivial cookie jar
var cookieJar = {};

// A macro for wsapi requests
var wsapi = {
  get: function (path, getArgs) {
    return function () {
      var cb = this.callback;
      if (typeof getArgs === 'object')
        path += "?" + querystring.stringify(getArgs);

      var headers = {};
      if (Object.keys(cookieJar).length) {
        headers['Cookie'] = "";
        for (var k in cookieJar) {
          headers['Cookie'] += k + "=" + cookieJar[k];
        }
      }
      http.get({
        host: '127.0.0.1',
        port: '62700',
        path: path,
        headers: headers
      }, function(res) {
        // see if there are any set-cookies that we should honor
        if (res.headers['set-cookie']) {
          res.headers['set-cookie'].forEach(function(cookie) {
            var m = /^([^;]+)(?:;.*)$/.exec(cookie);
            if (m) {
              var x = m[1].split('=');
              cookieJar[x[0]] = x[1];
            }
          });
        }
        var body = '';
        res.on('data', function(chunk) { body += chunk; })
          .on('end', function() {
            cb({code: res.statusCode, headers: res.headers, body: body});
          });
      }).on('error', function (e) {
        cb();
      });
    };
  }
};

suite.addBatch({
  "remove the user database": {
    topic: function() {
      removeVarDir();
      fs.mkdirSync(varPath, 0755);
      return true;
    },
    "directory should exist": function(x) {
      assert.ok(fs.statSync(varPath).isDirectory());
    }
  }
});

suite.addBatch({
  "run the server": {
    topic: function() {
      const server = require("../run.js");
      server.runServer();
      return true;
    },
    "server should be running": {
      topic: wsapi.get('/ping.txt'),
      "server is running": function (r, err) {
        assert.equal(r.code, 200);
      }
    }
  }
});

suite.addBatch({
  "wait for readiness": {
    topic: function() {
      var cb = this.callback;
      require("../lib/db.js").onReady(function() { cb(true) });
    },
    "readiness has arrived": function(v) {
      assert.ok(v);
    }
  }
});

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
// valid (*until* someone clicks through)

// try to log into the first email address with oldpassword
// XXX

// try to log into the second email address with oldpassword
// XXX

// try to log into the first email with newpassword
// XXX

// stop the server
suite.addBatch({
  "stop the server": {
    topic: function() {
      const server = require("../run.js");
      var cb = this.callback;
      server.stopServer(function() { cb(true); });
    },
    "stopped": function(x) {
      assert.strictEqual(x, true);
    }
  }
});


// clean up
suite.addBatch({
  "clean up": {
    topic: function() {
      removeVarDir();
      return true;
    },
    "directory should not exist": function(x) {
      assert.throws(function(){ fs.statSync(varPath) });
    }
  }
});

suite.run();
