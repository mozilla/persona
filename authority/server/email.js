exports.sendVerificationEmail = function(email, secret) {
  console.log("fakely sending a verification email for " + email);
  // XXX: what we would really do here is send out an email, instead
  // we'll just wait 5 seconds and manually feed the secret back into the
  // system, as if a user had clicked a link
  setTiemout(function() {
    db.gotVerificationSecret(secret);
  }, 5000);
};