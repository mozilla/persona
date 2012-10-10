const utils = require("./utils.js"),
request = require('request');

const DEFAULT_POLL = 1000;
const DEFAULT_TIMEOUT = 20000;

// get a randomly generated restmail email
exports.randomEmail = function(chars, domain) {
  var str = "";
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i=0; i < chars; i++) {
    str += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }

  // Until GH-2551 is fixed, use lowercase alphanum for email
  str = str.toLowerCase();

  return str + '@' + (domain ? domain : 'restmail.net');
};

// poll restmail to attempt to fetch a verification link,
// args include .timeout (optional), .poll (optional), and .email (required)
// callback is cb(error, verificationURL, fullEmail)
exports.getVerificationLink = function(args, cb) {
  var poll = args.poll || DEFAULT_POLL;
  var timeout = args.timeout || DEFAULT_TIMEOUT;
  var email = args.email;
  var url = 'http://restmail.net/mail/' + email.split('@')[0];

  utils.waitFor(poll, timeout, function(doneCB) {
    request(url, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        var b = JSON.parse(body);
        if (b.length > 0 && b[0].headers['x-browserid-verificationurl']) {
          doneCB(true, error, b[0].headers['x-browserid-verificationurl'], b[0]);
        }
        else doneCB(false);
      } else {
        doneCB(false);
      }
    })
  }, cb);
};
