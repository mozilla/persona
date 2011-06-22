var nodemailer = require('nodemailer');

nodemailer.EmailMessage.prototype.send = function(callback) {
    this.prepareVariables();
    var headers = this.generateHeaders(),
        body = this.generateBody();
    console.log(headers);
    console.log(body);
};