#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const assert = require('assert'),
vows = require('vows'),
secrets = require('../lib/secrets');

var suite = vows.describe('secrets');

var LENGTH = 10;

function make_secrets_batch(rand_func) {
  return {
    "generate a secret": {
      topic: function() {
        return rand_func(LENGTH);
      },
      "of proper length" : function(err, s) {
        assert.equal(s.length, LENGTH);
      }
    },
    "two secrets": {
      topic: function() {
        return {
          s1: rand_func(LENGTH),
          s2: rand_func(LENGTH)
        };
      },
      "are not equal" : function(err, the_secrets) {
        assert.notEqual(the_secrets.s1, the_secrets.s2);
      }
    }  
  };
};

// check that we can generate random secrets
suite.addBatch(make_secrets_batch(secrets.generate));
suite.addBatch(make_secrets_batch(secrets.weakGenerate));

// and the async one
suite.addBatch({
  "generate a secret": {
    topic: function() {
      secrets.generate(LENGTH, this.callback);
    },
    "of proper length" : function(s, err) {
      assert.equal(s.length, LENGTH);
    }
  }  
});
// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
