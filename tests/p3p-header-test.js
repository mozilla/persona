#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This is not really about second-guessing 3rd-Eden/useragent; it's more
// about exercising lib/p3p.js middleware in the server for regression tests.

require('./lib/test_env.js');

const 
assert = require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js');

var suite = vows.describe('p3p-header-test');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

const p3pPolicy = 'CP="This is not a P3P policy, but Mozilla deeply cares about ' +
  'your privacy. See http://www.mozilla.org/persona/privacy-policy ' +
  'for more."';

// not a comprehensive list, but cachified urls would be tricky to do reliably. Punt.
const urls = [
  '/',
  '/include.js',
  '/communication_iframe',
  '/wsapi/session_context',
];

const userAgents = [
  { ie: false, ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/29.0.1547.3 Safari/537.36' },
  { ie: false, ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_5) AppleWebKit/536.30.1 (KHTML, like Gecko) Version/6.0.5 Safari/536.30.1' },
  { ie: false, ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.7; rv:22.0) Gecko/20100101 Firefox/22.0' },
  { ie: false, ua: 'Opera/9.80 (Macintosh; Intel Mac OS X 10.7.5) Presto/2.12.388 Version/12.16' },
  { ie: true, ua: 'Mozilla/5.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1; .NET CLR 2.0.50727)' },
  { ie: true, ua: 'Mozilla/5.0 (compatible; MSIE 7.0; Windows NT 5.0; Trident/4.0; FBSMTWB; .NET CLR 2.0.34861; .NET CLR 3.0.3746.3218; .NET CLR 3.5.33652; msn OptimizedIE8;ENUS)' },
  { ie: true, ua: 'Mozilla/5.0 (compatible; MSIE 8.0; Windows NT 6.0; Trident/4.0; WOW64; Trident/4.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; .NET CLR 1.0.3705; .NET CLR 1.1.4322)' },
  { ie: true, ua: 'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0' },
  { ie: true, ua: 'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.2; WOW64; Trident/6.0)' },
  { ie: true, ua: 'Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; Touch; rv:11.0) like Gecko' }
];

function addBatch(ua, url) {
  suite.addBatch({
    "A user-agent": {
      topic: function() {
        var ctx = wsapi.getContext();
        ctx.headers = ctx.headers || {};
        ctx.headers['user-agent'] = ua.ua;
        wsapi.get(url, null, ctx).call(this);
      },
      "is served with a p3p header if it is IE": function(err, r) {
        assert.isNull(err);
        assert.strictEqual(r.code, 200);
        if (ua.ie) {
          assert.isDefined(r.headers.p3p);
          assert.strictEqual(r.headers.p3p, p3pPolicy);
        } else {
          assert.isUndefined(r.headers.p3p);
        }
      }
    }
  });
}

urls.forEach(function(url) {
  userAgents.forEach(function(ua) {
    addBatch(ua, url);
  });
});

start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
