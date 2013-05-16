#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
  Formats Firefox, Chrome and Safari localStorage sqlite databases for a given
  origin. Useful for stuff.

  Note: To use this script you will need to do `npm install sqlite3`. Works
    for me with sqlite3 3.7.13 on OSX. YMMV. (DO NOT DO `npm install
    sqlite`. That is a different package. `sqlite3` is
    'https://github.com/developmentseed/node-sqlite3'.

  Caveat: What can be read from the local disk file is not instantaneously in
    sync with reality (lazy flushing), but is eventually in sync. Generally,
    just do something with the browser then run this script and the state will
    be consistent within 1 second.

  Examples:
    Show everything for login.persona.org:
      ./scripts/inspect-localstorage.js -p /path/to/profile

    Show verbose everything for login.persona.org:
      ./scripts/inspect-localstorage.js -b firefox -p /path/to/profile -P -i

    Show interaction_data for login.anosrep.org:
      ./scripts/inspect-localstorage.js -p /path/to/profile -o https://login.anosrep.org -k interaction_data

    Show emails and usersComputer for login.anosrep.org:
      ./scripts/inspect-localstorage.js -p /path/to/profile -o https://login.anosrep.org -k emails,usersComputer

    Working with local instances:
      ./scripts/inspect-localstorage.js -b chrome -p /path/to/profile -o http://127.0.0.1:10002

  On OSX, the profiles you want are usually located here:
    firefox => ~/Library/Application\ Support/Firefox/Profiles/<salt>.<name>
    chrome  => ~/Library/Application\ Support/Google/Chrome/<profilename>
    safari  => ~/Library/Safari

*/

const
fs = require('fs'),
jwcrypto = require('jwcrypto'),
optimist = require('optimist'),
path = require('path'),
urlparse = require('urlparse'),
util = require('util');

var sqlite3, argv, args;
try {
  sqlite3 = require('sqlite3');
} catch(e) {
  console.log("** ERROR: require('sqlite3'). Try `npm install sqlite3`.\n");
  process.exit(1);
}

const USAGE =
  ('Read and format localStorage databases sqlite on ' +
   'Firefox, Chrome and Safari for a given origin.');

const OPTIONS = {
  h: {
    describe: 'display this usage message'
  },
  p: {
    describe: 'path to profile directory [default: process.env["INSPECT_LS"]]',
  },
  b: {
    describe: 'which browser? ["firefox", "chrome", "safari"]',
    'default': 'firefox'
  },
  o: {
    describe: 'origin to query from sqlite',
    'default': 'https://login.persona.org'
  },
  P: {
    describe: 'show full details for pub and priv keys; otherwise "{...}"',
    'default': false
  },
  i: {
    describe: 'show all details of interaction_data; otherwise "{...}"',
    'default': false
  },
  k: {
    describe: 'show only these keys from localStorage (csv)',
  },
  v: {
    describe: 'show the name of the database file',
    'default': false
  },
};

// Firefox persists all localStorage in a single sqlite3 database file.
// Chrome & Safari persist localStorage in a sqlite3 database file per origin.
function databaseFilename(origin) {
  var dbfile;
  if (args.b === 'firefox') {
    dbfile = path.join(args.p, 'webappsstore.sqlite');
  }
  else if (args.b === 'chrome' || args.b === 'safari') {
    // Chrome & Safari: convert the origin to the per-origin name of a database
    // file. e.g., https://login.persona.org -> https_login.persona.org_0.localstorage
    var url = urlparse(origin).normalize();
    var parts = [url.scheme, url.host, url.port || 0];
    var subdir = (args.b === 'chrome') ? 'Local Storage' : 'LocalStorage';
    dbfile = path.join(args.p, subdir, parts.join('_') + '.localstorage');
  }
  if (!fs.existsSync(dbfile)) {
    console.log('*** ERROR: No such sqlite file: ', dbfile);
    process.exit(1);
  }
  return dbfile;
}

// Firefox: convert the origin to the format of a 'scope' key in the shared
// database file.
// e.g., https://login.persona.org -> gro.anosrep.nigol.:https:443
function firefoxScopeKey(origin) {
  var url = urlparse(origin).normalize();
  var host = url.host.split('').reverse().join('') + '.';
  var parts = [host, url.scheme];
  var port = url.port;
  if (!port) port = (url.scheme === 'https') ? 443 : 80;
  parts.push(port);
  return parts.join(':');
}

function processOptions() {
  function optionError(message) {
    console.log('\n** ERROR: ' + message);
    argv.showHelp();
    process.exit(1);
  }

  argv = optimist
    .usage('\n' + USAGE + '\n\nUsage: $0 [options]')
    .options(OPTIONS)
    .wrap(80);
  args = argv.argv;
  if (args.h) {
    argv.showHelp();
    process.exit(1);
  }

  if (['firefox', 'chrome', 'safari'].indexOf(args.b) === -1) {
    optionError('option -b: must be firefox, chrome or safari');
  }

  if (!args.p) {
    args.p = process.env.INSPECT_LS;
    if (!args.p) {
      optionError('option -p: profile path is required');
    }
  }
  args.p = args.p.replace(/^~/, process.env.HOME);
  if (args.p[0] !== '/') args.p = path.resolve(process.cwd(), args.p);
  if (!fs.existsSync(args.p)) {
    optionError('option -p: profile path does not exist :' + args.p);
  }
  var stat = fs.statSync(args.p);
  if (!stat.isDirectory()) {
    optionError('option -p: profile path is not a directory: ' + args.p);
  }

  if (args.k) {
    args.k = args.k.split(',');
    args.i = true; // if asking for interaction_data, don't abbreviate
  }

  args.scopeKey = firefoxScopeKey(args.o);
  args.dbfile = databaseFilename(args.o);
  if (args.v) console.log("Inspecting", args.dbfile);
}

function processCertificate(cert) {
  var components = jwcrypto.extractComponents(cert);
  var payload = components.payload;
  ['signature',
   'headerSegment',
   'payloadSegment',
   'cryptoSegment'].forEach(function(key) {
     delete components[key];
   });
  if (!args.P) {
    payload["public-key"] = '{...}';
  }
  ['iat', 'exp'].forEach(function(key) {
    payload[key] = new Date(payload[key]).toISOString();
  });
  return components;
}

function processEmails(obj) {
  Object.keys(obj).forEach(function(email) {
    var elt = obj[email];
    Object.keys(elt).forEach(function(emailKey) {
      if (emailKey === 'cert') {
        elt[emailKey] = processCertificate(elt[emailKey]);
      }
      if ((emailKey === 'pub' || emailKey === 'priv') && !args.P) {
        elt[emailKey] = '{...}';
      }
    });
  });
}

function processRows(err, rows) {
  if (err) throw err;
  var localStorage = {};
  rows.forEach(function(row) {
    var key = row.key, value = row.value;
    if (Buffer.isBuffer(value)) {
      value = value.toString('ucs2'); // Chrome/Safari store as BLOB
    }
    value = JSON.parse(value);

    if (key === 'interaction_data' && !args.i) {
      if (Object.keys(value).length !== 0) {
        value = '{...}';
      }
    }

    if (key === 'emails') {
      // peek at the first key to see if it's email or issuer (or empty {})
      var firstKey = Object.keys(value)[0];
      if (firstKey) {
        if (firstKey.match(/@/)) {
          processEmails(value);
        } else {
          Object.keys(value).forEach(function(issuer) {
            processEmails(value[issuer]);
          });
        }
      }
    }

    localStorage[key] = value;
  });

  if (args.k) {
    Object.keys(localStorage).forEach(function(key) {
      if (args.k.indexOf(key) === -1) {
        delete localStorage[key];
      }
    });
  }

  console.log(JSON.stringify(localStorage, null, 2));
}

(function() {
  processOptions();
  var query, params;
  if (args.b === 'firefox') {
    query = 'SELECT key, value FROM webappsstore2 WHERE scope = ?';
    params = [ args.scopeKey ];
  } else if (args.b === 'chrome' || args.b === 'safari') {
    query = 'SELECT key, value FROM ItemTable';
    params = [];
  }
  new sqlite3.Database(args.dbfile, sqlite3.OPEN_READONLY, function(err) {
    if (err) throw err;
  }).all(query, params, processRows);
}());
