/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const emailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const config = require('./configuration.js');
const logger = require('./logging/logging.js').logger;
const url = require('url');
const cachify = require('connect-cachify').cachify;
const underscore = require('underscore');

const DEFAULT_BACKGROUND_COLOR = "45505b";
const TEMPLATE_PATH =
          path.join(__dirname, "..", "resources", "email_templates");


var emailTransport =
            emailer.createTransport("SMTP", getEmailTransportConfig());

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

compileTemplates();

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
var interceptor;
exports.setInterceptor = function(callback) {
  interceptor = callback;
};

exports.sendNewUserEmail = underscore.partial(doSend, 'new');
exports.sendConfirmationEmail = underscore.partial(doSend, 'confirm');
exports.sendForgotPasswordEmail = underscore.partial(doSend, 'reset');
exports.sendTransitionEmail = underscore.partial(doSend, 'transition');




function getEmailTransportConfig() {
  var emailTransportConfig = {};

  /* if smtp parameters are configured, use them */
  var smtp_params;
  try { smtp_params = config.get('smtp'); } catch(e) {}
  if (smtp_params && smtp_params.host) {
    emailTransportConfig = {
      host: smtp_params.host,
      port: smtp_params.port
    };
    logger.info("delivering email via SMTP host: "
                        + emailTransportConfig.host);

    if (smtp_params.user) {
      emailTransportConfig.auth = {
        user: smtp_params.user,
        pass: smtp_params.pass
      };

      logger.info("authenticating to email host as "
                        + emailTransportConfig.auth.user);
    }
  }

  return emailTransportConfig;
}

function compileTemplates() {
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
}


function doSend(emailType, email, site, secret, langContext,
    backgroundColor, siteLogo) {
  if (!templates[emailType]) throw "unknown email type: " + emailType;

  // remove scheme from site to make it more human
  site = url.parse(site).hostname;

  var verificationUrl = getVerificationUrl(emailType, secret);

  if (interceptor) {
    return interceptor(email, site, secret);
  } else if (config.get('email_to_console')) {
    // log verification email to console separated by whitespace.
    return console.log("\nVERIFICATION URL:\n" + verificationUrl + "\n");
  }

  var mailOpts = getMailOptions(emailType, email, verificationUrl, site,
                      langContext, backgroundColor, siteLogo);

  emailTransport.sendMail(mailOpts, function(err, success) {
    if (!success) {
      logger.error("error sending email to: " + email + " - " + err);
    }
  });
}



function getVerificationUrl(emailType, secret) {
  var emailConfig = templates[emailType];
  return config.get('public_url') + "/" + emailConfig.landing +
              "?token=" + encodeURIComponent(secret);
}

function getTemplateArgs(link, site, langContext, backgroundColor, siteLogo) {
  return {
    link: link,
    site: site,
    gettext: langContext.gettext,
    format: langContext.format,
    cachify: cachify,
    backgroundColor: getBackgroundColor(backgroundColor),
    siteLogo: siteLogo || ''
  };
}

function getMailOptions(emailType, email, verificationUrl, site, langContext,
                backgroundColor, siteLogo) {

  var emailConfig = templates[emailType];
  var GETTEXT = langContext.gettext;
  var format = langContext.format;
  var templateArgs =
        getTemplateArgs(verificationUrl, site, langContext,
            backgroundColor, siteLogo);

  var mailOpts = {
    sender: config.get('send_from_address'),
    to: email,
    subject: format(GETTEXT(emailConfig.subject), {
      site: site
    }),
    text: emailConfig.template(templateArgs),
    headers: {
      'X-BrowserID-VerificationURL': verificationUrl,
      'X-BrowserID-RelyingParty': site
    }
  };

  if (emailConfig.templateHTML) {
    mailOpts.html = emailConfig.templateHTML(templateArgs);
  }

  return mailOpts;
}

function getBackgroundColor(backgroundColor) {
  backgroundColor = backgroundColor || DEFAULT_BACKGROUND_COLOR;
  if (! /^#/.test(backgroundColor)) {
    backgroundColor = "#" + backgroundColor;
  }
  return backgroundColor;
}


