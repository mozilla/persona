#!/usr/bin/env node

const assert = require('assert'),
      vows = require('vows'),
      start_stop = require('./lib/start-stop.js'),
      wsapi = require('./lib/wsapi.js');

var suite = vows.describe('registration-status-wsapi');

// start up a pristine server
start_stop.addStartupBatches(suite);




// shut the server down and cleanup
start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
