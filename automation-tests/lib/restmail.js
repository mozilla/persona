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
// args include .timeout (optional), .poll (optional), .index (optional)
// and .email (required)
// callback is cb(error, verificationURL, fullEmail)
exports.getVerificationLink = function(args, cb) {
  // allow first argument to be an email address, which
  // is the only required argument
  if (typeof args === 'string') args = { email: args };

  if (!args.email) throw "missing required email address";

  var poll = args.poll || DEFAULT_POLL;
  var timeout = args.timeout || DEFAULT_TIMEOUT;
  var email = args.email;
  var index = args.index || 0;
  var url = 'http://restmail.net/mail/' + email;

  utils.waitFor(poll, timeout, function(doneCB) {
    request(url, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        var b = JSON.parse(body);
        var message = b[index];
        if (message && message.headers['x-browserid-verificationurl']) {
          var token = message.headers['x-browserid-verificationurl'].split('token=')[1];
          doneCB(true, error, token, message.headers['x-browserid-verificationurl'], message);
        }
        else doneCB(false);
      } else {
        doneCB(false);
      }
    });
  }, cb);
};
