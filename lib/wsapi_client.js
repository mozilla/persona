/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* this is a small standalone abstraction which lets scripts be
 * browserid WSAPI clients.  It handles CSRF token fetching and
 * extraction/resending of cookies.  It also allows one to have
 * any number of "client contexts" which are just objects, and lets
 * you simulated different simultaneous sessions.
 */

const
http = require('http'),
https = require('https'),
url = require('url'),
querystring = require('querystring'),
version = require('./version.js');

// this client library keeps timing stats to allow higher level code
// (like loadgen) to output latency numbers
var numberOfRequests = 0;
// consider latency over the last N requests
const LATENCY_DECAY = 300;
var recentLatency = 0;
function startRequest() {
  return new Date();
}
exports.recentLatency = function() { return recentLatency; };

function completeRequest(startTime) {
  numberOfRequests++;
  var num = numberOfRequests < LATENCY_DECAY ? numberOfRequests : LATENCY_DECAY;
  recentLatency = ((new Date() - startTime) + (recentLatency * (num - 1))) / num;
}

function injectCookies(ctx, headers) {
  if (ctx.cookieJar && Object.keys(ctx.cookieJar).length) {
    headers.Cookie = "";
    for (var k in ctx.cookieJar) {
      headers.Cookie += k + "=" + ctx.cookieJar[k];
    }
  }
}

function extractCookies(ctx, res) {
  if (ctx.cookieJar === undefined) ctx.cookieJar = {};
  if (res.headers['set-cookie']) {
    res.headers['set-cookie'].forEach(function(cookie) {
      var m = /^([^;]+)(?:;.*)$/.exec(cookie);
      if (m) {
        var x = m[1].split('=');
        ctx.cookieJar[x[0]] = x[1];
      }
    });
  }
}

exports.clearCookies = function(ctx) {
  if (ctx && ctx.cookieJar) delete ctx.cookieJar;
  if (ctx && ctx.session) delete ctx.session;
};

exports.getCookie = function(ctx, which) {
  if (typeof which === 'string') which = new RegExp('/^' + which + '$/');
  var cookieNames = Object.keys(ctx.cookieJar);
  for (var i = 0; i < cookieNames.length; i++) {
    if (which.test(cookieNames[i])) return ctx.cookieJar[cookieNames[i]];
  }
  return null;
};

exports.injectCookies = injectCookies;

function injectHeaders(context, headers) {
  if (context.headers) {
    for (var k in context.headers) {
      headers[k] = context.headers[k];
    }
  }
}

exports.get = function(cfg, path, context, getArgs, cb) {
  // parse the server URL (cfg.browserid)
  var uObj;
  var meth;
  try {
    uObj = url.parse(cfg.browserid);
    meth = uObj.protocol === 'http:' ? http : https;
  } catch(e) {
    cb("can't parse url: " + e);
    return;
  }

  version(function(commit) {
    var headers = {
      'BrowserID-git-sha': commit
    };
    injectHeaders(context, headers);
    injectCookies(context, headers);

    // skip the query string if getArgs is null (null is an object)
    if (typeof getArgs === 'object' && getArgs !== null)
      path += "?" + querystring.stringify(getArgs);

    var timingHandle = startRequest();
    meth.get({
      host: uObj.hostname,
      port: uObj.port,
      path: path,
      headers: headers,
      rejectUnauthorized: true,
      agent: false // disable node.js connection pooling
    }, function(res) {
      extractCookies(context, res);
      var body = '';
      res.on('data', function(chunk) { body += chunk; })
      .on('end', function() {
        completeRequest(timingHandle);
        cb(null, {code: res.statusCode, headers: res.headers, body: body});
        cb = null;
      });
    }).on('error', function (e) {
      cb(e);
      cb = null;
    });
  });
};

function withCSRF(cfg, context, cb) {
  if (context.session && context.session.csrf_token) cb(null, context.session.csrf_token);
  else {
    exports.get(cfg, '/wsapi/session_context', context, undefined, function(err, r) {
      if (err) return cb(err);
      try {
        if (r.code !== 200)
          return cb({what: "http error", resp: r}); // report first error
        context.session = JSON.parse(r.body);
        context.sessionStartedAt = new Date().getTime();
        cb(null, context.session.csrf_token);
      } catch(e) {
        console.log('error getting csrf token: ', e);
        cb(e);
      }
    });
  }
}

exports.post = function(cfg, path, context, postArgs, cb) {
  withCSRF(cfg, context, function(err, csrf) {
    if (err) {
        if (err.what === "http error") {
            // let the session_context HTTP return code speak for the overall
            // POST
            return cb(null, err.resp);
        }
        return cb(err);
    }

    // parse the server URL (cfg.browserid)
    var uObj;
    var meth;
    var body;
    try {
      uObj = url.parse(cfg.browserid);
      meth = uObj.protocol === 'http:' ? http : https;
    } catch(e) {
      cb("can't parse url: " + e);
      return;
    }

    version(function(commit) {
      var headers = {
        'Content-Type': 'application/json',
        'BrowserID-git-sha': commit
      };
      injectHeaders(context, headers);
      injectCookies(context, headers);

      if (typeof postArgs === 'object') {
        postArgs.csrf = csrf;
        body = JSON.stringify(postArgs);
        headers['Content-Length'] = Buffer.byteLength(body);
      }

      var timingHandle = startRequest();
      var req = meth.request({
        host: uObj.hostname,
        port: uObj.port,
        path: path,
        headers: headers,
        method: "POST",
        rejectUnauthorized: true,
        agent: false // disable node.js connection pooling
      }, function(res) {
        extractCookies(context, res);
        var body = '';
        res.on('data', function(chunk) { body += chunk; })
        .on('end', function() {
          completeRequest(timingHandle);
          cb(null, {code: res.statusCode, headers: res.headers, body: body});
          cb = null;
        });
      }).on('error', function (e) {
        cb(e);
        cb = null;
      });

      req.write(body);
      req.end();
    });
  });
};
