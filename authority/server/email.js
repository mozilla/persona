const db = require('./db');

exports.sendVerificationEmail = function(email, secret) {
    var url = "https://browserid.org/prove.html?token=" + secret;
    console.log("sending a verification email with url: " + url);
};
