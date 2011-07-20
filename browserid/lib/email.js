const
db = require('./db'),
emailer = require('nodemailer'),
fs = require('fs'),
path = require('path'),
mustache = require('mustache');

const template = fs.readFileSync(path.join(__dirname, "prove_template.txt")).toString();

exports.sendVerificationEmail = function(email, site, secret) {
  var url = "https://browserid.org/prove?token=" + encodeURIComponent(secret);

  emailer.send_mail({
    sender: "noreply@browserid.org",
    to: email,
    subject : "Complete Login to " + site + " using BrowserID",
    body: mustache.to_html(template, { email: email, link: url, site: site })
  }, function(err, success){
    if(!success) {
      console.log("error sending email: ", err);
      console.log("verification URL: ", url);
    }
  });
};
