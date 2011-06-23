const http = require('http'),
      querystring = require('querystring');

// wsapi abstractions trivial cookie jar
var cookieJar = {};

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
