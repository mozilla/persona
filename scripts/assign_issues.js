#!/usr/bin/env node

const https = require('https');

var options = {
  host: 'api.github.com',
  port: 443,
  path: '/repos/mozilla/browserid/issues?per_page=100&assignee=none'
};

var people = [
  'lloyd',
  'stomlinson',
  'benadida'
];

https.get(options, function(res) {
  var body = "";
  res.on('data', function(chunk) {
    body += chunk;
  }); 
  res.on('end', function() {
    processIssues(body);
  }); 
}).on('error', function(e) {
  console.log("Got error: " + e.message);
  process.exit(1);
});

function processIssues(json) {
  var issues = JSON.parse(json);
  var num = 0;
  issues = [issues[0]];
  issues.forEach(function(i) {
    if (!i.assignee) assignIssueTo(i.number, people[num++ % people.length]);
  });
}

function assignIssueTo(number, person) {
  var options = {
    host: 'api.github.com',
    port: 443,
    path: '/repos/mozilla/browserid/issues/' + number,
    method: 'PATCH'
  };
  var req = https.request(options, function(res) {
    console.log('STATUS: ' + res.statusCode);
    console.log('HEADERS: ' + JSON.stringify(res.headers));
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
      console.log('BODY: ' + chunk);
    });
  });
  var content = JSON.stringify({assignee:person});
  req.setHeader('content-length', content.length);
  req.write(content);
  req.end();
  console.log("assign issue", number, "to", person);
}
