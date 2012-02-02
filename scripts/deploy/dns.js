const
http = require('http'),
xml2json = require('xml2json'),
jsel = require('JSONSelect');

const envVar = 'BROWSERID_DEPLOY_DNS_KEY';
if (!process.env[envVar]) {
  throw "Missing api key!  contact lloyd and set the key in your env: "
    + envVar;
}

const api_key = process.env[envVar];

function doRequest(method, path, body, cb) {
  var req = http.request({
    auth: 'lloyd@hilaiel.com:' + api_key,
    host: 'ns.zerigo.com',
    port: 80,
    path: path,
    method: method,
    headers: {
      'Content-Type': 'application/xml',
      'Content-Length': body ? body.length : 0
    }
  }, function(r) {
    if ((r.statusCode / 100).toFixed(0) != 2 &&
        r.statusCode != 404) {
      return cb("non 200 status: " + r.statusCode);
    }
    buf = "";
    r.on('data', function(chunk) {
      buf += chunk;
    });
    r.on('end', function() {
      cb(null, JSON.parse(xml2json.toJson(buf)));
    });
  });
  if (body) req.write(body);
  req.end();
};

exports.updateRecord = function (hostname, zone, ip, cb) {
  doRequest('GET', '/api/1.1/zones.xml', null, function(err, r) {
    if (err) return cb(err);
    var m = jsel.match('object:has(:root > .domain:val(?)) > .id .$t',
                       [ zone ], r);
    if (m.length != 1) return cb("couldn't extract domain id from zerigo"); 
    var path = '/api/1.1/hosts.xml?zone_id=' + m[0];
    var body = '<host><data>' + ip + '</data><host-type>A</host-type>';
    body += '<hostname>' + hostname + '</hostname>'
    body += '</host>';
    doRequest('POST', path, body, function(err, r) {
      cb(err);
    });
  });
};

exports.deleteRecord = function (hostname, cb) {
  doRequest('GET', '/api/1.1/hosts.xml?fqdn=' + hostname, null, function(err, r) {
    if (err) return cb(err);
    var m = jsel.match('.host .id > .$t', r);
    if (!m.length) return cb("no such DNS record");
    function deleteOne() {
      if (!m.length) return cb(null);
      var one = m.shift();
      doRequest('DELETE', '/api/1.1/hosts/' + one + '.xml', null, function(err) {
        if (err) return cb(err);
        deleteOne();
      });
    }
    deleteOne();
  });
};

exports.inUse = function (hostname, cb) {
  doRequest('GET', '/api/1.1/hosts.xml?fqdn=' + hostname, null, function(err, r) {
    if (err) return cb(err);
    var m = jsel.match('.hosts object:.host', r);
    // we shouldn't have multiple!  oops!  let's return the first one
    if (m.length) return cb(null, m[0]);
    cb(null, null);
  });
}
