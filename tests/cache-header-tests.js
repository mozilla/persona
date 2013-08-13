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
  if (['/communication_iframe', '/relay', '/en/embedded_tos', '/en/embedded_privacy'].indexOf(path) !== -1) {
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
      // ensure public, max-age=0, must-revalidate
      assert.strictEqual(r.headers['cache-control'], 'public, max-age=0, must-revalidate');
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

// verify that cache control headers exist
function hasETaglessCacheHeaders(path) {
  return {
    topic: function() {
      var self = this;
      doRequest(path, {}, self.callback);
    },
    "returns 200 with content": function(err, r) {
      assert.strictEqual(r.statusCode, 200);
      // ensure public, max-age=10
      assert.strictEqual(r.headers['cache-control'], 'public, max-age=10');
    }
  }
}

// TODO: the commented urls should gain proper cache headers for conditional GET
suite.addBatch({
  '/': hasProperCacheHeaders('/'),
  '/sign_in': hasProperCacheHeaders('/sign_in'),
  '/communication_iframe': hasProperCacheHeaders('/communication_iframe'),
  '/unsupported_dialog': hasProperCacheHeaders('/unsupported_dialog'),
  '/unsupported_dialog_without_watch':
      hasProperCacheHeaders('/unsupported_dialog_without_watch'),
  '/cookies_disabled': hasProperCacheHeaders('/cookies_disabled'),
  '/relay': hasProperCacheHeaders('/relay'),
  '/about': hasProperCacheHeaders('/about'),
  '/en/tos': hasProperCacheHeaders('/en/tos'),
  '/en/embedded_tos': hasProperCacheHeaders('/en/embedded_tos'),
  '/en/privacy': hasProperCacheHeaders('/en/privacy'),
  '/en/embedded_privacy': hasProperCacheHeaders('/en/embedded_privacy'),
  '/verify_email_address': hasProperCacheHeaders('/verify_email_address'),
  '/add_email_address': hasProperCacheHeaders('/add_email_address'),
  '/confirm': hasProperCacheHeaders('/confirm'),
//  '/pk': hasProperCacheHeaders('/pk'),
  '/.well-known/browserid': hasETaglessCacheHeaders('/.well-known/browserid')
});

// related to cache headers are correct headers which let us serve static resources
// (not rendered views) from a different domain, to support CDN compat
suite.addBatch({
  "static resources": {
    topic: function() {
      doRequest("/favicon.ico", {}, this.callback);
    },
    "have proper access control headers": function(err, r) {
      assert.strictEqual(r.statusCode, 200);
      assert.strictEqual(r.headers['access-control-allow-origin'],"http://127.0.0.1:10002");
    }
  }
});

// shut the server down and cleanup
if (!process.env['SERVER_URL']) {
  start_stop.addShutdownBatches(suite);
}

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
