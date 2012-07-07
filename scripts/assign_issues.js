#!/usr/bin/env node
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const https = require('https');

// people to get issues, and the issues that were assigned to them
var people = {
  'jedp': [],
  'seanmonstar': [],
  'ozten': [],
  'lloyd': [],
  'shane-tomlinson': [],
  'benadida': []
};

var auth = process.env.AUTH;

if (typeof auth !== 'string') {
  console.log("oops.  define env var AUTH with '<github uname>:<github pass>'");
  process.exit(1);
}

https.get({
  host: 'api.github.com',
  port: 443,
  path: '/repos/mozilla/browserid/issues?per_page=100&assignee=none'
}, function(res) {
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

// count of how many issues are left to assign, used to determine when we're done for
// final output
var assigning = 0;

function outputResults() {
  console.log("All issues assigned:");
  Object.keys(people).forEach(function(person) {
    console.log(" ", person + ":", people[person].join(", "));
  });
}

function processIssues(json) {
  var issues = JSON.parse(json);
  var num = 0;
  issues.forEach(function(i) {
    if (!i.assignee) {
      assigning++;
      assignIssueTo(i.number, Object.keys(people)[num++ % Object.keys(people).length]);
    }
  });
}

function assignIssueTo(number, person) {
  var options = {
    host: 'api.github.com',
    port: 443,
    path: '/repos/mozilla/browserid/issues/' + number,
    method: 'POST'
  };

  var req = https.request(options, function(res) {
    console.log("  * assign issue", number, "to", person, "-", res.statusCode);
    res.setEncoding('utf8');
    people[person].push(number);
    if (--assigning === 0) outputResults();
  });
  var content = JSON.stringify({assignee:person});
  req.setHeader('content-length', content.length);
  req.setHeader('Authorization', "Basic " + new Buffer(auth, 'utf8').toString('base64'));
  req.write(content);
  req.end();
}
