const
db = require('../db.js'),
wsapi = require('../wsapi.js'),
httputils = require('../httputils'),
logger = require('../logging.js').logger,
bcrypt = require('../bcrypt'),
http = require('http'),
https = require('https'),
querystring = require('querystring'),
statsd = require('../statsd');

exports.method = 'post';
exports.writes_db = false;
exports.authed = false;
exports.args = ['email','assertion'];

exports.process = function(req, res) {
  // this WSAPI will be invoked when a user attempts to authenticate with
  // an assertion from a primary identity authority.  It might seemlessly
  // create a user account if that's needed

  // XXX: write me
  return res.json({ success: false, reason: "not implemented" });
};
