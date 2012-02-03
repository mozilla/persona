#!/usr/bin/env node

/*
 * Deploy dev.diresworb.org, for fun and profit.
 */

const
aws = require('./deploy/aws.js');
path = require('path');
vm = require('./deploy/vm.js'),
key = require('./deploy/key.js'),
ssh = require('./deploy/ssh.js'),
git = require('./deploy/git.js'),
dns = require('./deploy/dns.js'),
util = require('util'),
events = require('events'),
fs = require('fs');

// verify we have files we need

// a class capable of deploying and emmitting events along the way
function DevDeployer() {
  events.EventEmitter.call(this);

  this.sslpub = process.env['DEV_SSL_PUB'];
  this.sslpriv = process.env['DEV_SSL_PRIV'];

  if (!this.sslpub || !this.sslpriv) {
    throw("you must provide ssl cert paths via DEV_SSL_PUB & DEV_SSL_PRIV");
  }

  if (!fs.statSync(this.sslpub).isFile() || !fs.statSync(this.sslpriv).isFile()) {
    throw("DEV_SSL_PUB & DEV_SSL_PRIV must be paths to actual files.  duh");
  }
}

util.inherits(DevDeployer, events.EventEmitter);

DevDeployer.prototype.setup = function(cb) {
  var self = this;
  git.currentSHA(function(err, r) {
    if (err) return cb(err);
    self.sha = r;
    vm.startImage(function(err, r) {
      if (err) return cb(err);
      self.emit('progress', "starting new image");
      vm.waitForInstance(r.instanceId, function(err, d) {
        if (err) return cb(err);
        self.deets = d;
        self.emit('progress', "image started");
        vm.setName(r.instanceId, "dev.diresworb.org (" + self.sha + ")", function(err, r) {
          if (err) return cb(err);
          self.emit('progress', "name set");
          cb(null);
        });
      });
    });
  });
}

DevDeployer.prototype.configure = function(cb) {
  var self = this;
  var config = { public_url: "https://dev.diresworb.org" };
  ssh.copyUpConfig(self.deets.ipAddress, config, function (err) {
    if (err) return cb(err);
    ssh.copySSL(self.deets.ipAddress, self.sslpub, self.sslpriv, cb);
  });
}

DevDeployer.prototype.pushCode = function(cb) {
  var self = this;
  git.push(this.deets.ipAddress, function(d) { self.emit('build_output', d); }, cb);
}

DevDeployer.prototype.updateDNS = function(cb) {
  var self = this;
  dns.deleteRecord('dev.diresworb.org', function() {
    dns.updateRecord('', 'dev.diresworb.org', self.deets.ipAddress, cb);
  });
}

var deployer = new DevDeployer();

deployer.on('progress', function(d) {
  console.log("PR: " + d);
});

deployer.on('build_output', function(d) {
  console.log("BO: " + d);
});

function checkerr(err) {
  if (err) {
    process.stderr.write("fatal error: " + err + "\n");
    process.exit(1);
  }
}

var startTime = new Date();
deployer.setup(function(err) {
  checkerr(err);
  deployer.configure(function(err) {
    checkerr(err);
    deployer.updateDNS(function(err) {
      checkerr(err);
      deployer.pushCode(function(err) {
        checkerr(err);
        console.log("dev.diresworb.org (" + deployer.sha + ") deployed to " +
                    deployer.deets.ipAddress + " in " +
                    ((new Date() - startTime) / 1000.0).toFixed(2) + "s");
      });
    });
  });
});
