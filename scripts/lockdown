#!/usr/bin/env node

if (process.env['NPM_LOCKDOWN_RUNNING']) process.exit(0);

console.log("NPM Lockdown is here to check your dependencies!  Never fear!");

var http = require('http'),
    crypto = require('crypto'),
    exec = require('child_process').exec,
    fs = require('fs'),
    path = require('path');

try {
  var lockdownJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'lockdown.json')));
} catch(e) {
  console.log("\nERROR: I cannot read lockdown.json!  run node_modules/.bin/lockdown-relock to generate!\n");
  process.exit(1);
}

var boundPort;

// during execution fatal errors will be appended to this list
var errors = [];

// during execution non-fatal warnings will be appended to this list
var warn = [];

function rewriteURL(u) {
    return u.replace('registry.npmjs.org', '127.0.0.1:' + boundPort);
}

function packageOk(name, ver, sha, required) {
  if (!lockdownJson[name]) {
    if (required) {
      errors.push("package '" + name + "' not in lockdown.json!");
    }
    return false;
  }

  if (lockdownJson[name][ver] === undefined) {
    if (required) {
      errors.push("package version " + name + "@" + ver + " not in lockdown.json!");
    }
    return false;
  }

  // a '*' shasum is not checked
  var wantSHA = lockdownJson[name][ver];
  if (wantSHA !== '*' && wantSHA !== sha) {
    if (required) {
      errors.push("package " + name + "@" + ver + " has a different checksum (" +
                  wantSHA + " v. " + sha + ")");
    }
    return false;
  }

  if (wantSHA === '*') {
    warn.push("Lockdown cannot guarantee your saftey!  No sha for pkg " + name + "@" + ver +
              " in lockdown.json");
  }

  return true;
}


function rewriteVersionMD(json) {
  if (typeof json === 'string') json = JSON.parse(json);
  if (!json.error) {
    json.dist.tarball = rewriteURL(json.dist.tarball);

    // is the name/version/sha in our lockdown.json?
    if (!packageOk(json.name, json.version, json.dist.shasum, true)) return null;
  }
  return JSON.stringify(json);
}

function rewritePackageMD(json) {
  if (typeof json === 'string') json = JSON.parse(json);
  if (!json.error) {
    Object.keys(json.versions).forEach(function(ver) {
      var data = json.versions[ver];
      var name = data.name;
      var sha = data.dist ? data.dist.shasum : undefined;

      if (packageOk(name, ver, sha, false)) {
        data.dist.tarball = rewriteURL(data.dist.tarball);
      } else {
        delete json.versions[ver];
      }
    });
  }
  return JSON.stringify(json);
}

var server = http.createServer(function (req, res) {
  if (req.method !== 'GET') {
    return res.end('non GET requests not supported', 501);
  }

  // what type of request is this?
  // 1. specific version json metadata (when explicit dependency is expressed)
  //    - for these requests we should verify the name/version/sha advertised is allowed
  // 2. package version json metadata (when version range is expressed - including '*')
  //    XXX: for these requests we should prune all versions that are not allowed
  // 3. tarball - actual bits
  //    XXX: for these requests we should verify the name/version/sha matches something
  //         allowed, otherwise block the transaction
  var arr = req.url.substr(1).split('/');
  var type = [ '', 'package_metadata', 'version_metadata', 'tarball' ][arr.length];

  // let's extract pkg name and version sensitive to the type of request being performed.
  var pkgname, pkgver;
  if (type === 'tarball') {
    pkgname = arr[0];
    var getVer = new RegExp("^" + pkgname + "-(.*)\\.tgz$");
    pkgver = getVer.exec(arr[2])[1];
  } else if (type === 'version_metadata') {
    pkgname = arr[0];
    pkgver = arr[1];
  } else if (type === 'package_metadata') {
    pkgname = arr[0];
  }

  var hash = crypto.createHash('sha1');

  var r = http.request({
    host: 'registry.npmjs.org',
    port: 80,
    method: req.method,
    path: req.url,
    agent: false
  }, function(rres) {
    res.setHeader('Content-Type', rres.headers['content-type']);
    if (type === 'tarball') res.setHeader('Content-Length', rres.headers['content-length']);
    var b = "";
    rres.on('data', function(d) {
      hash.update(d);
      if (type != 'tarball') b += d;
      else res.write(d);
    });
    rres.on('end', function() {
      if (type === 'tarball') {
        res.end();
      } else {
        if (type === 'package_metadata') {
          b = rewritePackageMD(b);
        } else if (type === 'version_metadata') {
          b = rewriteVersionMD(b);
        }
        if (b === null) {
          res.writeHead(404);
          res.end("package installation disallowed by lockdown");
        } else {
          res.setHeader('Content-Length', Buffer.byteLength(b));
          res.writeHead(rres.statusCode);
          res.end(b);
        }
      }
    });
  });
  r.end();
});

server.listen(process.env['LOCKDOWN_PORT'] || 0, '127.0.0.1', function() {
  boundPort = server.address().port;

  var child = exec('npm install', {
    env: {
      NPM_CONFIG_REGISTRY: 'http://127.0.0.1:' + boundPort,
      NPM_LOCKDOWN_RUNNING: "true",
      PATH: process.env['PATH'],
      HOME: process.env['HOME']
    },
    cwd: process.cwd()
  }, function(e) {
    if (warn.length) {
      console.log();
      console.log("LOCKDOWN WARNINGS:");
      warn.forEach(function(e) { console.log("   ", e); });
      console.log();
    }
    if (errors.length) {
      console.log();
      console.log("LOCKDOWN ERRORS:");
      errors.forEach(function(e) { console.log("   ", e); });
      console.log();
    }
    process.exit(e ? 1 : 0);
  });
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
});
