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
