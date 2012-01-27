const
aws = require('./aws.js'),
path = require('path'),
fs = require('fs'),
child_process = require('child_process'),
jsel = require('JSONSelect'),
crypto = require('crypto');

const keyPath = process.env['PUBKEY'] || path.join(process.env['HOME'], ".ssh", "id_rsa.pub");

exports.read = function(cb) {
  fs.readFile(keyPath, cb);
};

exports.fingerprint = function(cb) {
  exports.read(function(err, buf) {
    if (err) return cb(err);
    var b = new Buffer(buf.toString().split(' ')[1], 'base64');
    var md5sum = crypto.createHash('md5');
    md5sum.update(b);
    cb(null, md5sum.digest('hex'));
  });
/*
  child_process.exec(
    "ssh-keygen -lf " + keyPath,
    function(err, r) {
      if (!err) r = r.split(' ')[1];
      cb(err, r);
    });
*/
};

exports.getName = function(cb) {
  exports.fingerprint(function(err, fingerprint) {
    if (err) return cb(err);

    var keyName = "browserid deploy key (" + fingerprint + ")";

    // is this fingerprint known?
    aws.call('DescribeKeyPairs', {}, function(result) {
      var found = jsel.match(":has(.keyName:val(?)) > .keyName", [ keyName ], result); 
      if (found.length) return cb(null, keyName);

      // key isn't yet installed!
      exports.read(function(err, key) {
        aws.call('ImportKeyPair', {
          KeyName: keyName,
          PublicKeyMaterial: new Buffer(key).toString('base64')
        }, function(result) {
          if (!result) return cb('null result from ec2 on key addition');
          if (result.Errors) return cb(result.Errors.Error.Message);
          cb(null, keyName);
        });
      });
    });
  });
};
