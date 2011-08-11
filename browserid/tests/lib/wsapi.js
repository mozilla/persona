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

const
http = require('http'),
querystring = require('querystring');

// wsapi abstractions trivial cookie jar
var cookieJar = {};

exports.clearCookies = function() { cookieJar = {}; };

// A macro for wsapi requests
exports.get = function (path, getArgs) {
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
};

// fetch the CSRF token for POSTs
var fetchCSRF = function(headers, cb) {
  return http.get({
      host: '127.0.0.1',
      port: '62700',
      path: '/csrf',
      headers: headers
    }, function(res) {
      var body = "";
      res.on('data', function(chunk) { body += chunk; })
      .on('end', function() {
          cb(body);
        });
    }).on('error', function (e) {
      cb();
    });
};


// FIXME: dedup code

// A macro for wsapi requests
// add CSRF protection to this test
exports.post = function (path, postArgs) {
  return function () {
    var cb = this.callback;

    var headers = {
      'content-type': 'application/x-www-form-urlencoded'
    };

    if (Object.keys(cookieJar).length) {
      headers['Cookie'] = "";
      for (var k in cookieJar) {
        headers['Cookie'] += k + "=" + cookieJar[k];
      }
    }

    fetchCSRF(headers, function(csrf) {
        if (typeof postArgs === 'object') {
          postArgs['csrf'] = csrf;
          body = querystring.stringify(postArgs);
        }

        var req = http.request({
            host: '127.0.0.1',
            port: '62700',
            path: path,
            headers: headers,
            method: "POST"
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

        // send the POST
        req.write(body);
        req.end();
      });
  };
};
