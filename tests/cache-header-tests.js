#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const assert = require('assert'),
http = require('http'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
urlparse = require('urlparse');

var suite = vows.describe('cache header tests');
suite.options.error = false;

// allow this unit test to be targeted
var SERVER_URL = process.env['SERVER_URL'] || 'http://127.0.0.1:10002/';

if (!process.env['SERVER_URL']) {
  // start up a pristine server if we're locally testing
  start_stop.addStartupBatches(suite);
}

// now parse out host, port and scheme
var purl = urlparse(SERVER_URL);
const method = (purl.scheme === 'https') ? require('https') : require('http');

function doRequest(path, headers, cb) {
  var req = method.request({
    port: purl.port,
    host: purl.host,
    path: path,
    headers: headers,
    agent: false
  }, function(res) {
    req.abort();
    cb(null, res);
  });
  req.on('error', function(e) {
    cb(e);
  });
  req.end();
}

function hasProperFramingHeaders(r, path) {
  if (['/communication_iframe', '/relay'].indexOf(path) !== -1) {
    assert.strictEqual(r.headers['x-frame-options'], undefined);
  } else {
    assert.strictEqual(r.headers['x-frame-options'],"DENY");
  }
}

function hasProperCacheHeaders(path) {
  return {
    topic: function() {
      var self = this;
      // note we do *two* requests to the same resource.  The way
      // etagify works is to generate content based hashes on the first
      // request, and then use them every subsequent request.  This
      // minimizes complexity and buffering that we do, at the cost of
      // the first client after server restart possibly getting a couple
      // extra kilobytes over the wire in a 200-that-shoulda-been-a-304.
      // See issue #1331 and https://github.com/lloyd/connect-etagify
      // for more context.
      doRequest(path, {}, function(err, r) {
        if (err) self.callback(err, r);
        else doRequest(path, {}, self.callback);
      });
    },
    "returns 200 with content": function(err, r) {
      assert.strictEqual(r.statusCode, 200);
      // check X-Frame-Option headers
      hasProperFramingHeaders(r, path);
      // ensure vary headers
      assert.strictEqual(r.headers['vary'], 'Accept-Encoding,Accept-Language');
      // ensure public, max-age=0
      assert.strictEqual(r.headers['cache-control'], 'public, max-age=0');
      // the behavior of combining a last-modified date and an etag is undefined by
      // rfc2616, so let's always use ETags, and ignore last modified date.
      assert.ok(r.headers['etag'])
      assert.isUndefined(r.headers['last-modified']);
      // we need Vary headers as responses may be localized
      assert.strictEqual(r.headers['vary'], 'Accept-Encoding,Accept-Language');
    },
    "followed by a request with if-none-match": {
      topic: function(err, r) {
        doRequest(path, {
          "If-None-Match": r.headers['etag']
        }, this.callback);
      },
      "returns a 304": function(err, r) {
        if (!err) hasProperFramingHeaders(r, path);
        assert.strictEqual(r.statusCode, 304);
      }
    },
    "followed by a request with an if-modified-since cache header, and bogus etag": {
      topic: function(err, r) {
        var etag = r.headers['etag'] = '"bogus"';
        // No ETag present in iframes, make one
        if (['/communication_iframe', '/relay'].indexOf(path) === -1) {
          etag = r.headers['etag'].replace(/"$/, "bogus\"");
        }
        doRequest(path, {
          "If-None-Match": etag
        }, this.callback);
      },
      "returns a 200": function(err, r) {
        assert.strictEqual(r.statusCode, 200);
      }
    }
  }
}

// TODO: the commented urls should gain proper cache headers for conditional GET
suite.addBatch({
  '/': hasProperCacheHeaders('/'),
  '/sign_in': hasProperCacheHeaders('/sign_in'),
  '/communication_iframe': hasProperCacheHeaders('/communication_iframe'),
  '/unsupported_dialog': hasProperCacheHeaders('/unsupported_dialog'),
  '/cookies_disabled': hasProperCacheHeaders('/cookies_disabled'),
  '/relay': hasProperCacheHeaders('/relay'),
  '/authenticate_with_primary': hasProperCacheHeaders('/authenticate_with_primary'),
  '/signup': hasProperCacheHeaders('/signup'),
  '/idp_auth_complete': hasProperCacheHeaders('/idp_auth_complete'),
  '/forgot': hasProperCacheHeaders('/forgot'),
  '/signin': hasProperCacheHeaders('/signin'),
  '/about': hasProperCacheHeaders('/about'),
  '/tos': hasProperCacheHeaders('/tos'),
  '/privacy': hasProperCacheHeaders('/privacy'),
  '/verify_email_address': hasProperCacheHeaders('/verify_email_address'),
  '/add_email_address': hasProperCacheHeaders('/add_email_address'),
  '/confirm': hasProperCacheHeaders('/confirm'),
//  '/pk': hasProperCacheHeaders('/pk'),
//  '/.well-known/browserid': hasProperCacheHeaders('/.well-known/browserid')
});

// shut the server down and cleanup
if (!process.env['SERVER_URL']) {
  start_stop.addShutdownBatches(suite);
}

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
