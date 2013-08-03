/*jshint sub: true */

const utils = require("./utils.js"),
urls = require('./urls.js'),
request = require('request');

// TODO factor out common bits with lib/restmail
// TODO accept all the personatestuser arguments

const DEFAULT_TIMEOUT = 40000;

// grab user creds from personatestuser.org.
// args include .timeout (optional), .env (optional)
// callback is cb(error, {email, password}, fullResponse)
exports.getVerifiedUser = function(args, cb) {
  if (arguments.length === 1) {
    cb = args;
    args = {};
  }
  var timeout = args.timeout || DEFAULT_TIMEOUT;
  var url = urls.personatestuser;

  request({ url: url, timeout: timeout, json:true}, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      if (!body.email) { return cb(new Error('funky getVerifiedUser response')); }
      cb(error, {email: body.email, pass: body.pass}, body);
    } else {
      cb(error || response.body);
    }
  });
};

