/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla BrowserID.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

const
db = require('db.js'),
emailer = require('nodemailer'),
fs = require('fs'),
path = require('path'),
mustache = require('mustache'),
config = require('configuration.js'),
logger = require('logging.js').logger;

/* if smtp parameters are configured, use them */
var smtp_params = config.get('smtp');
if (smtp_params && smtp_params.host) {
  emailer.SMTP = { host: smtp_params.host };
  logger.info("delivering email via SMTP host: " +  emailer.SMTP.host);
  if (smtp_params.user) {
    logger.info("authenticating to email host as" +  emailer.SMTP.user);
    emailer.SMTP.use_authentication = true;
    emailer.SMTP.user = smtp_params.user;
    emailer.SMTP.pass = smtp_params.pass;
  }
}

const template = fs.readFileSync(path.join(__dirname, "prove_template.txt")).toString();

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

function doSend(landing_page, email, site, secret) {
  var url = config.get('URL') + "/" + landing_page + "?token=" + encodeURIComponent(secret);

  if (interceptor) {
    interceptor(email, site, secret);
  } else if (config.get('email_to_console')) {
    // log verification email to console separated by whitespace.
    console.log("\nVERIFICATION URL:\n" + url + "\n");
  } else {
    emailer.send_mail({
      sender: "noreply@browserid.org",
      to: email,
      subject : "Complete Login to " + site + " using BrowserID",
      body: mustache.to_html(template, { email: email, link: url, site: site })
    }, function(err, success){
      if(!success) {
        logger.error("error sending email: " + err);
        logger.error("verification URL: " + url);
      }
    });
  };
};

exports.sendNewUserEmail = function(email, site, secret) {
  doSend('verify_email_address', email, site, secret);
};

exports.sendAddAddressEmail = function(email, site, secret) {
  doSend('add_email_address', email, site, secret);
};
