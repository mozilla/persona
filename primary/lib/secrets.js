const path = require('path'),
        fs = require('fs');

function generateSecret() {
  var str = "";
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i=0; i < 128; i++) {
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
    console.log("Generating server secret ("+name+")...");
    secret = generateSecret();
    fs.writeFileSync(p, secret);
  }
  return secret;
};
