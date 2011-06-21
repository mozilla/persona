const db = require('./db'),
 emailer = require('nodemailer'),
      fs = require('fs'),
    path = require('path'),
mustache = require('mustache');

const template = fs.readFileSync(path.join(__dirname, "prove_template.txt")).toString();

exports.sendVerificationEmail = function(email, secret) {
    var url = "https://browserid.org/prove.html?token=" + secret;

    emailer.send_mail({
        sender: "noreply@browserid.org",
        to: email,
        subject : "BrowserID: confirm email address - " + email,
        body: mustache.to_html(template, { email: email, link: url })
    }, function(err, success){
        if(!success) console.log("error sending email: ", err);
    });
};
