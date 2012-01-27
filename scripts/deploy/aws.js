const
awslib = require('aws-lib');

module.exports = awslib.createEC2Client(process.env['AWS_ID'], process.env['AWS_SECRET'], {
  version: '2011-12-15'
});

