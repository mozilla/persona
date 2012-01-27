#!/usr/bin/env node

const
aws = require('./deploy/aws.js');
path = require('path');
vm = require('./deploy/vm.js'),
key = require('./deploy/key.js');

var verbs = {};

function checkErr(err) {
  if (err) {
    process.stderr.write('fatal error: ' + err + "\n");
    process.exit(1);
  }
}

verbs['deploy'] = function(args) {
  vm.startImage(function(err, r) {
    checkErr(err);
    vm.waitForInstance(r.instanceId, function(err, r) {
      console.log(err, r);
    });
  });
};

verbs['list'] = function(args) {
  vm.list(function(err, r) {
    checkErr(err);
    console.log(JSON.stringify(r, null, 2));
  });
};

var error = (process.argv.length <= 2); 

if (!error) {
  var verb = process.argv[2];
  if (!verbs[verb]) error = "no such command: " + verb;
  else {
    verbs[verb](process.argv.slice(2));
  }
}

if (error) {
  if (typeof error === 'string') process.stderr.write('fatal error: ' + error + "\n\n");

  process.stderr.write('A command line tool to deploy BrowserID onto Amazon\'s EC2\n');
  process.stderr.write('Usage: ' + path.basename(__filename) +
                       ' <' + Object.keys(verbs).join('|') + "> [args]\n");
  process.exit(1);
}
