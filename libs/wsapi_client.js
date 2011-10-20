/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla BrowserID.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Lloyd Hilaiel <lloyd@hilaiel.com> 
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
querystring = require('querystring');

function injectCookies(ctx, headers) {
  if (ctx.cookieJar && Object.keys(ctx.cookieJar).length) {
    headers['Cookie'] = "";
    for (var k in ctx.cookieJar) {
      headers['Cookie'] += k + "=" + ctx.cookieJar[k];
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
  if (ctx && ctx.csrf) delete ctx.csrf;
};

exports.injectCookies = injectCookies;

exports.get = function(cfg, path, context, getArgs, cb) {
  // parse the server URL (cfg.browserid)
  var uObj;
  var meth;
  try {
    uObj = url.parse(cfg.browserid);
    meth = uObj.protocol === 'http:' ? http : https;
  } catch(e) {
    cb(false);
    return;
  }
  
  var headers = { };
  injectCookies(context, headers);

  if (typeof getArgs === 'object')
    path += "?" + querystring.stringify(getArgs);

  meth.get({
    host: uObj.hostname,
    port: uObj.port,
    path: path,
    headers: headers
  }, function(res) {
    extractCookies(context, res);
    var body = '';
    res.on('data', function(chunk) { body += chunk; })
    .on('end', function() {
      cb({code: res.statusCode, headers: res.headers, body: body});
    });
  }).on('error', function (e) {
    cb();
  });
};

function withCSRF(cfg, context, cb) {
  if (context.csrf) cb(context.csrf);
  else {
    exports.get(cfg, '/wsapi/session_context', context, undefined, function(r) {
      try {
        if (r.code !== 200) throw 'http error';
        context.csrf = JSON.parse(r.body).csrf_token;
        cb(context.csrf);
      } catch(e) {
        console.log('error getting csrf token: ', e);
        cb();
      }
    });
  }
}

exports.post = function(cfg, path, context, postArgs, cb) {
  withCSRF(cfg, context, function(csrf) {
    // parse the server URL (cfg.browserid)
    var uObj;
    var meth;
    try {
      uObj = url.parse(cfg.browserid);
      meth = uObj.protocol === 'http:' ? http : https;
    } catch(e) {
      cb(false);
      return;
    }
    var headers = {
      'content-type': 'application/x-www-form-urlencoded'
    };
    injectCookies(context, headers);

    if (typeof postArgs === 'object') {
      postArgs['csrf'] = csrf;
      body = querystring.stringify(postArgs);
    }

    var req = meth.request({
      host: uObj.hostname,
      port: uObj.port,
      path: path,
      headers: headers,
      method: "POST"
    }, function(res) {
      extractCookies(context, res);
      var body = '';
      res.on('data', function(chunk) { body += chunk; })
      .on('end', function() {
        cb({code: res.statusCode, headers: res.headers, body: body});
      });
    }).on('error', function (e) {
      cb();
    });

    req.write(body);
    req.end();
  });
};
