const
path = require('path'),
fs = require('fs');

exports.generate = function(chars) {
  var str = "";
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i=0; i < chars; i++) {
    str += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return str;
}

exports.hydrateSecret = function(name, dir) {
  var p = path.join(dir, name + ".sekret");
  var fileExists = false;
  var secret = undefined;

  try{ secret = fs.readFileSync(p).toString(); } catch(e) {};

  if (secret === undefined) {
    secret = exports.generate(128);
    fs.writeFileSync(p, secret);
  }
  return secret;
};
