#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
fs = require('fs'),
jwcrypto = require('jwcrypto'),
optimist = require('optimist'),
path = require('path'),
urlparse = require('urlparse'),
util = require('util'),
cp = require('child_process'),
os = require('os'),
async = require('async');

const WEBAPPSSTORE_SQLITE = 'webappsstore.sqlite';

function heredoc(fn) {
  return fn.toString().split('\n').slice(1, -1).join('\n');
}

const extendedHelp = heredoc(function() {/*
  Formats Persona information in localStorage for Firefox, Chrome, Safari,
  Opera+Blink, and B2G localStorage sqlite databases for a given
  origin. Useful for various testing and development stuff.

  PRE-REQUISITE: To use this script you will need to do `npm install
  sqlite3`. Works for me with sqlite3 >3.7.13 on OSX. YMMV. (DO NOT do `npm
  install sqlite`. That is a different package. `sqlite3` is
  'https://github.com/developmentseed/node-sqlite3'.

  CAVEAT: What can be read from the local disk file is not instantaneously in
  sync with reality (lazy flushing), but is eventually in sync. Generally,
  just do something with the browser, wait ~1 second, and the state will then
  be consistent with browser memory.

  NOTE ABOUT B2G: It works with B2G devices by pulling the webappsstore.sqlite
  database into a temporary location on your computer. It is up to you to have
  connected the device with USB to your computer first (and have a working
  setup with `adb`). Note: the "scope" key on B2G is like the Firefox key, but
  is prepended with '\d+:[a-z]:'; I haven't researched what that implies.
  Anyone want to enlighten me?

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
    opera   => ~/Library/Application\ Support/com.operasoftware.Opera
    b2g     => 'adb:/data/b2g/mozilla/<profile>/webappsstore.sqlite' (Hard coded in this script).

*/});

var sqlite3, argv, args;
try {
  sqlite3 = require('sqlite3');
} catch(e) {
  console.log("This tool requires you to first do `npm install sqlite3`.\n");
  process.exit(1);
}

const USAGE =
  ('Read and format localStorage databases sqlite on Firefox, Chrome,\n' +
   'Safari, Opera Blink and FirefoxOS for a given origin.');

const OPTIONS = {
  h: {
    describe: 'display this usage message'
  },
  help: {
    describe: 'Show extended help message'
  },
  p: {
    describe: 'path to profile directory [default: process.env["INSPECT_LS"]]',
  },
  b: {
    describe: 'which browser? ["firefox", "chrome", "safari", "opera", "b2g"]',
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
    describe: 'show a bit more detail about program operation',
    'default': false
  },
};

function adbPullWebappsstore(dbfile, callerCb) {
  var ADB_EOL = '\r\n';

  function findSqlitePath(callback) {
    var glob = './data/b2g/mozilla/*/' + WEBAPPSSTORE_SQLITE;
    var cmd = "adb shell 'ls " + glob + "'";

    cp.exec(cmd, function(err, stdout, stderr) {
      if (err) return callback(err);
      if (stderr && args.v) console.error(stderr);

      var files = stdout.split(ADB_EOL).filter(function(item) {
        return item !== '';
      });

      if (files.length === 0) {
        return callback('Could not find the B2G profile');
      }

      if (files.length > 1) {
        console.error('Found more than one profile! Returning the first');
      }

      callback(null, files[0]);
    });
  }

  function adbPullSqlite(adbPath, callback) {
    var cmd = "adb pull " + adbPath + " " + dbfile;
    if (args.v) console.error('Executing: `' + cmd + '`');

    cp.exec(cmd, function(err, stdout, stderr) {
      if (err) return callback(err);
      if (stderr && args.v) console.error(stderr);
      callback(null);
    });
  }

  async.waterfall([ findSqlitePath, adbPullSqlite ], callerCb);
}

function checkDbFileExists(dbfile) {
  if (!fs.existsSync(dbfile)) {
    console.log('*** ERROR: No such sqlite file: ', dbfile);
    return process.exit(1);
  }
}

//
// Firefox persists all localStorage in a single sqlite3 database file.
// Chrome, Safari and Opera Blink persist localStorage in a sqlite3 database
// file per origin.
//
function databaseFilename(origin) {
  var dbfile;

  if (args.b === 'firefox') {
    dbfile = path.join(args.p, WEBAPPSSTORE_SQLITE);
  } else if (['chrome', 'safari', 'opera'].indexOf(args.b) !== -1) {
    // Chrome/Safari/Opera+Blink: convert the origin to the per-origin name of
    // a database file; '0' implies default port, else the actual IP port number.
    // i.e., https://login.persona.org -> https_login.persona.org_0.localstorage
    var url = urlparse(origin).normalize();
    var parts = [url.scheme, url.host, url.port || 0];
    var subdir = (['chrome', 'opera'].indexOf(args.b) !== -1)
      ? 'Local Storage'
      : 'LocalStorage';
    dbfile = path.join(args.p, subdir, parts.join('_') + '.localstorage');
  }

  checkDbFileExists(dbfile);

  return dbfile;
}

//
// Firefox: convert the origin to the format of a 'scope' key in the shared
// database file.
// e.g., https://login.persona.org -> gro.anosrep.nigol.:https:443
//
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
    process.exit(0);
  }

  if (args.help) {
    argv.showHelp();
    console.log(extendedHelp);
    process.exit(0);
  }

  var supportedBrowsers = ['firefox', 'chrome', 'safari', 'opera', 'b2g'];
  if (supportedBrowsers.indexOf(args.b) === -1) {
    optionError('option -b: must be one of ' + supportedBrowsers.join(', '));
  }

  // B2G does not require args.p; it's in a temporary location.
  if (args.b !== 'b2g') {
    if (!args.p) {
      args.p = process.env.INSPECT_LS;
      if (!args.p) {
        optionError('option -p: profile path is required');
      }
    }
    args.p = args.p.replace(/^~/, process.env.HOME);
    if (args.p[0] !== '/') args.p = path.resolve(process.cwd(), args.p);

    if (!fs.existsSync(args.p)) {
      optionError('option -p: profile path does not exist : ' + args.p);
    }

    var stat = fs.statSync(args.p);
    if (!stat.isDirectory()) {
      optionError('option -p: profile path is not a directory: ' + args.p);
    }
  }

  if (args.k) {
    args.k = args.k.split(',');
    args.i = true; // if asking for interaction_data, don't abbreviate
  }

  args.scopeKey = firefoxScopeKey(args.o);

  // we'll figure out the db filename for b2g later
  if (args.b !== 'b2g') {
    args.dbfile = databaseFilename(args.o);
    if (args.v) console.error("Inspecting", args.dbfile);
  }
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

function processEmail(elt) {
  Object.keys(elt).forEach(function(emailKey) {
    if (emailKey === 'cert') {
      elt[emailKey] = processCertificate(elt[emailKey]);
    }
    if ((emailKey === 'pub' || emailKey === 'priv') && !args.P) {
      elt[emailKey] = '{...}';
    }
  });
}

function processEmails(obj) {
  Object.keys(obj).forEach(function(email) {
    var elt = obj[email];
    if (email.match(/@/)) {
      processEmail(elt);
    } else {
      Object.keys(elt).forEach(function(emailKey) {
        processEmail(elt[emailKey]);
      });
    }
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
      processEmails(value);
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

function queryDatabaseB2G() {
  args.dbfile = path.join(os.tmpDir(), WEBAPPSSTORE_SQLITE);
  adbPullWebappsstore(args.dbfile, function(err) {
    if (err) {
      console.error('*** ERROR: Pulling from b2g: ', err.message || err);
      return process.exit(1);
    }
    checkDbFileExists(args.dbfile);
    if (args.v) console.error("Inspecting", args.dbfile);
    queryDatabase();
  });
}

function queryDatabase() {
  var query, params;

  if (args.b === 'b2g') {
    query = 'SELECT scope, key, value FROM webappsstore2 WHERE scope like ?';
    params = ['%:' + args.scopeKey];
  } else if (args.b === 'firefox') {
    query = 'SELECT key, value FROM webappsstore2 WHERE scope = ?';
    params = [ args.scopeKey ];
  } else if (['chrome', 'safari', 'opera'].indexOf(args.b) !== -1) {
    query = 'SELECT key, value FROM ItemTable';
    params = [];
  }

  new sqlite3.Database(args.dbfile, sqlite3.OPEN_READONLY, function(err) {
    if (err) throw err;
  }).all(query, params, processRows);
}

(function main() {
  processOptions();

  if (args.b === 'b2g') {
    queryDatabaseB2G();
  } else {
    queryDatabase();
  }
}());
