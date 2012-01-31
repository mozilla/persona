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
    console.log(r.headers);
//    if (r.statusCode != 200) return cb("non 200 status: " + r.statusCode);
    buf = "";
    r.on('data', function(chunk) {
      buf += chunk;
    });
    r.on('end', function() {
      console.log(buf);
      cb(null, JSON.parse(xml2json.toJson(buf)));
    });
  });
  if (body) req.write(body);
  req.end();
};

exports.addRecord = function (hostname, ip, cb) {
  doRequest('GET', '/api/1.1/zones.xml', null, function(err, r) {
    if (err) return cb(err);
    var m = jsel.match('object:has(:root > .domain:val(?)) > .id .$t',
                       [ 'hacksign.in' ], r);
    if (m.length != 1) return cb("couldn't extract domain id from zerigo"); 
    var path = '/api/1.1/hosts.xml?zone_id=' + m[0];
    var body = '<host><data>' + ip + '</data><host-type>A</host-type>';
    body += '<hostname>' + hostname + '.hacksign.in</hostname>'
    body += '<priority type="integer" nil="true"/>';
    body += '<ttl type="integer" nil="true"/></host>';
    console.log(xml2json.toJson(body));
    doRequest('POST', '/api/1.1/zones.xml', body, function(err, r) {
      console.log(err, JSON.stringify(r, null, 2));
    });
  });
};



