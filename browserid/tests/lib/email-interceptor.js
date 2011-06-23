// a tiny abstraction which kludges its way into nodemailer to intercept
// outbound emails for testing

const nodeMailer = require('nodemailer');

exports.onEmail = undefined;
exports.lastEmailBody = undefined;
exports.token = undefined;

// let's kludge our way into nodemailer to intercept outbound emails
nodeMailer.EmailMessage.prototype.send = function(callback) {
  exports.lastEmailBody = this.body;
  var m = /token=([a-zA-Z0-9]+)/.exec(exports.lastEmailBody);
  exports.token = m[1];
  if (exports.onEmail) exports.onEmail(exports.token, exports.lastEmailBody);
};
