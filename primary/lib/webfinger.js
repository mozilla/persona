const  db = require('./db.js'),
       fs = require('fs'),
 mustache = require('mustache'),
     path = require('path');

const TEMPLATE = fs.readFileSync(path.join(__dirname, "webfinger_template.xml")).toString();

exports.renderUserPage = function(identity, cb) {

  var idParts = identity.split("@");
  var userpart = idParts[0];

  db.pubkeysForUsername(userpart, function(keys) {
    if (!keys || keys.length === 0) cb(undefined);
    else {
      cb(mustache.to_html(TEMPLATE, {
        keys: keys,
        email: identity
      }));
    }
  });
};
