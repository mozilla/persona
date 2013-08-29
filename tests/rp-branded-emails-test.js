#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const assert        = require('assert'),
      vows          = require('vows'),
      start_stop    = require('./lib/start-stop.js'),
      secondary     = require('./lib/secondary.js'),
      wsapi         = require('./lib/wsapi.js'),
      secrets       = require('../lib/secrets.js'),
      email         = require('../lib/email.js');

const FIRST_EMAIL   = secrets.weakGenerate(12) + '@somedomain.com',
      SECOND_EMAIL  = secrets.weakGenerate(12) + '@otherdomain.com',
      TEST_PASS     = 'thisismypassword',
      TEST_SITE     = 'https://fakesite.com';

var generatedEmails;
function interceptor(email, site, secret, emails) {
  assert.ok(false);
  generatedEmails = emails;
}

var suite = vows.describe('rp-branded-emails');

start_stop.addStartupBatches(suite);

suite.addBatch({
  "/wsapi/stage_user with invalid backgroundColor": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: FIRST_EMAIL,
      pass: TEST_PASS,
      site: TEST_SITE,
      backgroundColor: 'g',
      siteLogo: TEST_SITE + "/rp_background.png"
    }),
    "fails": function(err, r) {
      assert.equal(r.code, 400);
      assert.equal(JSON.parse(r.body).reason, "backgroundColor: Error: not a valid color: g");
    }
  }
});

suite.addBatch({
  "/wsapi/stage_user with invalid siteLogo": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: FIRST_EMAIL,
      pass: TEST_PASS,
      site: TEST_SITE,
      backgroundColor: '#fedcba',
      siteLogo: "http://invalid.protocol/site_logo.png"
    }),
    "fails": function(err, r) {
      assert.equal(r.code, 400);
      assert.equal(JSON.parse(r.body).reason, "siteLogo: Error: siteLogos can only be served from https and data schemes.");
    }
  }
});

suite.addBatch({
  "/wsapi/stage_user with valid backgroundColor and siteLogo": {
    topic: function() {
      secondary.create({
        email: FIRST_EMAIL,
        pass: TEST_PASS,
        site: TEST_SITE,
        backgroundColor: '#fedcba',
        siteLogo: TEST_SITE + "/rp_background.png"
      }, this.callback);
    },
    "succeeds": function(err, r) {
      assert.equal(r.code, 200);
    }
  }
});


suite.addBatch({
  "/wsapi/stage_email with invalid backgroundColor": {
    topic: wsapi.post('/wsapi/stage_email', {
      email: SECOND_EMAIL,
      pass: TEST_PASS,
      site: TEST_SITE,
      backgroundColor: 'g',
      siteLogo: TEST_SITE + "/rp_background.png"
    }),
    "fails": function(err, r) {
      assert.equal(r.code, 400);
      assert.equal(JSON.parse(r.body).reason, "backgroundColor: Error: not a valid color: g");
    }
  }
});

suite.addBatch({
  "/wsapi/stage_email with invalid siteLogo": {
    topic: wsapi.post('/wsapi/stage_email', {
      email: SECOND_EMAIL,
      pass: TEST_PASS,
      site: TEST_SITE,
      backgroundColor: '#fedcba',
      siteLogo: "http://invalid.protocol/site_logo.png"
    }),
    "fails": function(err, r) {
      assert.equal(r.code, 400);
      assert.equal(JSON.parse(r.body).reason, "siteLogo: Error: siteLogos can only be served from https and data schemes.");
    }
  }
});

suite.addBatch({
  "/wsapi/stage_email with valid siteLogo and backgroundColor": {
    topic: wsapi.post('/wsapi/stage_email', {
      email: SECOND_EMAIL,
      pass: TEST_PASS,
      site: TEST_SITE,
      backgroundColor: '#fedcba',
      siteLogo: TEST_SITE + "/rp_background.png"
    }),
    "succeeds": function(err, r) {
      assert.equal(r.code, 200);
    }
  }
});

suite.addBatch({
  "/wsapi/stage_reset with invalid backgroundColor": {
    topic: wsapi.post('/wsapi/stage_reset', {
      email: SECOND_EMAIL,
      site: TEST_SITE,
      backgroundColor: 'g',
      siteLogo: TEST_SITE + "/rp_background.png"
    }),
    "fails": function(err, r) {
      assert.equal(r.code, 400);
      assert.equal(JSON.parse(r.body).reason, "backgroundColor: Error: not a valid color: g");
    }
  }
});

suite.addBatch({
  "/wsapi/stage_reset with invalid siteLogo": {
    topic: wsapi.post('/wsapi/stage_reset', {
      email: SECOND_EMAIL,
      site: TEST_SITE,
      backgroundColor: '#fedcba',
      siteLogo: "http://invalid.protocol/site_logo.png"
    }),
    "fails": function(err, r) {
      assert.equal(r.code, 400);
      assert.equal(JSON.parse(r.body).reason, "siteLogo: Error: siteLogos can only be served from https and data schemes.");
    }
  }
});

suite.addBatch({
  "/wsapi/stage_reset with valid backgroundColor and siteLogo": {
    topic: wsapi.post('/wsapi/stage_reset', {
      email: SECOND_EMAIL,
      site: TEST_SITE,
      backgroundColor: '#fedcba',
      siteLogo: TEST_SITE + "/rp_background.png"
    }),
    "succeeds": function(err, r) {
      assert.equal(r.code, 200);
    }
  }
});


suite.addBatch({
  "/wsapi/stage_reverify with invalid backgroundColor": {
    topic: wsapi.post('/wsapi/stage_reverify', {
      email: FIRST_EMAIL,
      site: TEST_SITE,
      backgroundColor: 'g',
      siteLogo: TEST_SITE + "/rp_background.png"
    }),
    "fails": function(err, r) {
      assert.equal(r.code, 400);
      assert.equal(JSON.parse(r.body).reason, "backgroundColor: Error: not a valid color: g");
    }
  }
});

suite.addBatch({
  "/wsapi/stage_reverify with invalid siteLogo": {
    topic: wsapi.post('/wsapi/stage_reverify', {
      email: FIRST_EMAIL,
      site: TEST_SITE,
      backgroundColor: '#fedcba',
      siteLogo: "http://invalid.protocol/site_logo.png"
    }),
    "fails": function(err, r) {
      assert.equal(r.code, 400);
      assert.equal(JSON.parse(r.body).reason, "siteLogo: Error: siteLogos can only be served from https and data schemes.");
    }
  }
});

suite.addBatch({
  "/wsapi/stage_reverify with valid backgroundColor and siteLogo": {
    topic: wsapi.post('/wsapi/stage_reverify', {
      email: FIRST_EMAIL,
      site: TEST_SITE,
      backgroundColor: '#fedcba',
      siteLogo: TEST_SITE + "/rp_background.png"
    }),
    "succeeds": function(err, r) {
      assert.equal(r.code, 200);
    }
  }
});

suite.addBatch({
  "/wsapi/stage_transition with invalid backgroundColor": {
    topic: wsapi.post('/wsapi/stage_transition', {
      email: SECOND_EMAIL,
      site: TEST_SITE,
      pass: TEST_PASS,
      backgroundColor: 'g',
      siteLogo: TEST_SITE + "/rp_background.png"
    }),
    "fails": function(err, r) {
      assert.equal(r.code, 400);
      assert.equal(JSON.parse(r.body).reason, "backgroundColor: Error: not a valid color: g");
    }
  }
});

suite.addBatch({
  "/wsapi/stage_transition with invalid siteLogo": {
    topic: wsapi.post('/wsapi/stage_transition', {
      email: SECOND_EMAIL,
      pass: TEST_PASS,
      site: TEST_SITE,
      backgroundColor: '#fedcba',
      siteLogo: "http://invalid.protocol/site_logo.png"
    }),
    "fails": function(err, r) {
      assert.equal(r.code, 400);
      assert.equal(JSON.parse(r.body).reason, "siteLogo: Error: siteLogos can only be served from https and data schemes.");
    }
  }
});

suite.addBatch({
  "/wsapi/stage_transition with valid backgroundColor and siteLogo": {
    topic: wsapi.post('/wsapi/stage_transition', {
      email: SECOND_EMAIL,
      site: TEST_SITE,
      pass: TEST_PASS,
      backgroundColor: '#fedcba',
      siteLogo: TEST_SITE + "/rp_background.png"
    }),
    "succeeds": function(err, r) {
      assert.equal(r.code, 200);
    }
  }
});


start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);

