/* this Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
emailer = require('nodemailer'),
fs = require('fs'),
path = require('path'),
ejs = require('ejs'),
config = require('./configuration.js'),
logger = require('./logging.js').logger,
url = require('url'),
cachify = require('connect-cachify').cachify;

/* if smtp parameters are configured, use them */
try { var smtp_params = config.get('smtp'); } catch(e) {}
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

const TEMPLATE_PATH = path.join(__dirname, "..", "resources", "email_templates");

// the underbar decorator to allow getext to extract strings
function _(str) { return str; }

// a map of all the different emails we send
const templates = {
  "new": {
    landing: 'verify_email_address',
    subject: _("Confirm email address for Persona"),
    template: fs.readFileSync(path.join(TEMPLATE_PATH, 'new.ejs')),
    templateHTML: fs.readFileSync(path.join(TEMPLATE_PATH, 'new.html.ejs'))
  },
  "reset": {
    landing: 'reset_password',
    subject: _("Reset Persona password"),
    template: fs.readFileSync(path.join(TEMPLATE_PATH, 'reset.ejs')),
    templateHTML: fs.readFileSync(path.join(TEMPLATE_PATH, 'reset.html.ejs'))
  },
  "confirm": {
    landing: 'confirm',
    subject: _("Confirm email address for Persona"),
    template: fs.readFileSync(path.join(TEMPLATE_PATH, 'confirm.ejs')),
    templateHTML: fs.readFileSync(path.join(TEMPLATE_PATH, 'confirm.html.ejs'))
  },
  "transition": {
    landing: 'confirm',
    subject: _("Confirm email address for Persona"),
    template: fs.readFileSync(path.join(TEMPLATE_PATH, 'transition.ejs')),
    templateHTML: fs.readFileSync(path.join(TEMPLATE_PATH, 'transition.html.ejs'))
  },
};

// now turn file contents into compiled templates
Object.keys(templates).forEach(function(type) {
  templates[type].template = ejs.compile(templates[type].template.toString());
  if (templates[type].templateHTML) {
    templates[type].templateHTML = ejs.compile(templates[type].templateHTML.toString());
  }
});


var interceptor;

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
function doSend(email_type, email, site, secret, langContext) {
  if (!templates[email_type]) throw "unknown email type: " + email_type;

  // remove scheme from site to make it more human
  site = url.parse(site).hostname;

  var email_params = templates[email_type];

  var public_url = config.get('public_url') + "/" + email_params.landing + "?token=" + encodeURIComponent(secret),
      GETTEXT = langContext.gettext,
      format = langContext.format;

  if (interceptor) {
    interceptor(email, site, secret);
  } else if (config.get('email_to_console')) {
    // log verification email to console separated by whitespace.
    console.log("\nVERIFICATION URL:\n" + public_url + "\n");
  } else {
    var templateArgs = {
      link: public_url,
      site: site,
      gettext: GETTEXT,
      format: format,
      cachify: cachify
    };

    var mailOpts = {
      // XXX: Ideally this would be a live email address and a response to these email
      // addresses would go into a ticketing system (lloyd/skinny)
      sender: "Persona <no-reply@persona.org>",
      to: email,
      subject: GETTEXT(email_params.subject),
      text: email_params.template(templateArgs),
      headers: {
        'X-BrowserID-VerificationURL': public_url,
        'X-BrowserID-RelyingParty': site
      }
    };

    if (email_params.templateHTML) {
      mailOpts.html = email_params.templateHTML(templateArgs);
    }

    emailer.send_mail(mailOpts, function(err, success) {
      if (!success) {
        logger.error("error sending email to: " + email + " - " + err);
      }
    });
  }
}

exports.sendNewUserEmail = function(email, site, secret, langContext) {
  doSend('new', email, site, secret, langContext);
};

exports.sendConfirmationEmail = function(email, site, secret, langContext) {
  doSend('confirm', email, site, secret, langContext);
};

exports.sendForgotPasswordEmail = function(email, site, secret, langContext) {
  doSend('reset', email, site, secret, langContext);
};

exports.sendTransitionEmail = function(email, site, secret, langContext) {
  doSend('transition', email, site, secret, langContext);
};
