/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
emailer = require('nodemailer'),
fs = require('fs'),
path = require('path'),
ejs = require('ejs'),
config = require('./configuration.js'),
logger = require('./logging/logging.js').logger,
url = require('url'),
cachify = require('connect-cachify').cachify;

const DEFAULT_BACKGROUND_COLOR = "45505b";

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
    subject: _("%(site)s: Complete sign-in"),
    template: 'new.ejs',
    templateHTML: 'new.html.ejs'
  },
  "reset": {
    landing: 'reset_password',
    subject: _("%(site)s: Complete password reset"),
    template: 'reset.ejs',
    templateHTML: 'reset.html.ejs'
  },
  "confirm": {
    landing: 'confirm',
    subject: _("%(site)s: Complete sign-in"),
    template: 'confirm.ejs',
    templateHTML: 'confirm.html.ejs'
  },
  "transition": {
    landing: 'complete_transition',
    subject: _("%(site)s: Complete sign-in"),
    template: 'transition.ejs',
    templateHTML: 'transition.html.ejs'
  },
};

// turn template file contents into compiled templates
Object.keys(templates).forEach(function(type) {
  var templatePath = path.join(TEMPLATE_PATH, templates[type].template);
  var template = fs.readFileSync(templatePath);

  templates[type].template = ejs.compile(template.toString(), {
    filename: templatePath
  });

  if (templates[type].templateHTML) {
    var templateHTMLPath = path.join(TEMPLATE_PATH, templates[type].templateHTML);
    var templateHTML = fs.readFileSync(templateHTMLPath);

    templates[type].templateHTML = ejs.compile(templateHTML.toString(), {
      filename: templateHTMLPath
    });
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

function getBackgroundColor(backgroundColor) {
  backgroundColor = backgroundColor || DEFAULT_BACKGROUND_COLOR;
  if (! /^#/.test(backgroundColor)) {
    backgroundColor = "#" + backgroundColor;
  }
  return backgroundColor;
}


function doSend(email_type, email, site, secret, langContext,
    backgroundColor, siteLogo) {
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
      cachify: cachify,
      backgroundColor: getBackgroundColor(backgroundColor),
      siteLogo: siteLogo || ''
    };

    var mailOpts = {
      // XXX: Ideally this would be a live email address and a response to these email
      // addresses would go into a ticketing system (lloyd/skinny)
      sender: "Persona <no-reply@persona.org>",
      to: email,
      subject: format(GETTEXT(email_params.subject), {
        site: site
      }),
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

exports.sendNewUserEmail = function(email, site, secret, langContext, backgroundColor, siteLogo) {
  doSend('new', email, site, secret, langContext, backgroundColor, siteLogo);
};

exports.sendConfirmationEmail = function(email, site, secret, langContext, backgroundColor, siteLogo) {
  doSend('confirm', email, site, secret, langContext, backgroundColor, siteLogo);
};

exports.sendForgotPasswordEmail = function(email, site, secret, langContext, backgroundColor, siteLogo) {
  doSend('reset', email, site, secret, langContext, backgroundColor, siteLogo);
};

exports.sendTransitionEmail = function(email, site, secret, langContext, backgroundColor, siteLogo) {
  doSend('transition', email, site, secret, langContext, backgroundColor, siteLogo);
};
