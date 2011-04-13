const db = require('./db');

exports.sendVerificationEmail = function(email, secret) {
  console.log("fakely sending a verification email for " + email);
  // XXX: what we would really do here is send out an email, instead
  // we'll just wait 5 seconds and manually feed the secret back into the
  // system, as if a user had clicked a link
  setTimeout(function() {
    db.gotVerificationSecret(secret, function(e) {
      if (e) {
        console.log("error completing the verification: " + e);
      }
    });
  }, 5000);
};