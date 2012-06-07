/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
emailer = require('nodemailer'),
fs = require('fs'),
path = require('path'),
ejs = require('ejs'),
config = require('./configuration.js'),
logger = require('./logging.js').logger;

/* if smtp parameters are configured, use them */
try { var smtp_params = config.get('smtp'); } catch(e) {};
if (smtp_params && smtp_params.host) {
  emailer.SMTP = {
    host: smtp_params.host,
    port: smtp_params.port
  };
  logger.info("delivering email via SMTP host: " +  emailer.SMTP.host);
  if (smtp_params.user) {
    emailer.SMTP.use_authentication = true;
    emailer.SMTP.user = smtp_params.user;
    emailer.SMTP.pass = smtp_params.pass;

    logger.info("authenticating to email host as " +  emailer.SMTP.user);
  }
}

const template = ejs.compile(
    fs.readFileSync(path.join(__dirname, "browserid", "prove_template.ejs")).toString());

var interceptor = undefined;

/**
 * allow clients to intercept email messages programatically for local
 * testing. The `interceptor` is a function which accepts three arguments,
 *
 *   * `email` - the email that is being verified
 *   * `site` - the RP
 *   * `secret` - the verification secret (usually embedded into a url)
 *
 * Limitations: only a single interceptor may be set, generalize
 * as needed.
 */
exports.setInterceptor = function(callback) {
  interceptor = callback;
};

//TODO send in localeContext
function doSend(landing_page, email, site, secret, langContext) {
  var url = config.get('public_url') + "/" + landing_page + "?token=" + encodeURIComponent(secret),
      _ = langContext.gettext,
      format = langContext.format;

  if (interceptor) {
    interceptor(email, site, secret);
  } else if (config.get('email_to_console')) {
    // log verification email to console separated by whitespace.
    console.log("\nVERIFICATION URL:\n" + url + "\n");
  } else {
    // TODO(aok) extract_po.sh isn't seeing this string if it's below in object literal
    var subject = format(_("Complete Login to %s using Persona"), [site]);
    emailer.send_mail({
      sender: "Persona@persona.org",
      to: email,
      subject: subject,
      body: template({ link: url, site: site, gettext: _, format: format })
    }, function(err, success){
      if (!success) {
        logger.error("error sending email to: " + email + " - " + err);
      }
    });
  };
};

exports.sendNewUserEmail = function(email, site, secret, langContext) {
  doSend('verify_email_address', email, site, secret, langContext);
};

exports.sendAddAddressEmail = function(email, site, secret, langContext) {
  doSend('add_email_address', email, site, secret, langContext);
};
