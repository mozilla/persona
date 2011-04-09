// registered emails
var g_emails = {
};

// half created user accounts (pending email verification)
// OR
// half added emails (pending verification)
var g_staged = {
};

exports.haveEmail = function(email) {
  return g_emails.hasOwnProperty(email);
};

function generateSecret() {
  var str = "";
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i=0; i < 32; i++) {
    str += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return str;
}

/* takes an argument object including email, pass, and pubkey. */
exports.stageUser = function(obj) {
  var secret = generateSecret();
  // overwrite previously staged users
  g_staged[secret] = {
    email: obj.email,
    pubkey: obj.pubkey,
    pass: obj.pass
  };
  return secret;
};

/* invoked when a user clicks on a verification URL in their email */ 
exports.gotVerificationSecret = function(secret) {
  if (!g_staged.hasOwnProperty(secret)) return false;

  // simply move from staged over to the emails "database"
  var o = g_staged[secret];
  delete g_staged[secret];
  g_emails[o.email] = {
    pass: o.pass,
    pubkey: o.pubkey
  };
  return true;
};
