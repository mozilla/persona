// registered emails
var g_emails = {
};

// half created user accounts (pending email verification)
var g_stagedUsers = {
};

// half added emails (pending verification)
var g_stagedEmails = {
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
  g_stagedUsers[obj.email] = {
    secret: secret,
    pubkey: obj.pubkey,
    pass: obj.pass
  };
  return secret;
};
