const
aws = require('./aws.js');
jsel = require('JSONSelect'),
key = require('./key.js');

// every time you change the security group, change this version number
// so new deployments will create a new group with the changes
const SECURITY_GROUP_VERSION = 1;

function createError(msg, r) {
  var m = jsel.match('.Message', r);
  if (m.length) msg += ": " + m[0];
  return msg;
}

exports.getName = function(cb) {
  var groupName = "browserid group v" + SECURITY_GROUP_VERSION;

  // is this fingerprint known?
  aws.call('DescribeSecurityGroups', {
    GroupName: groupName
  }, function(r) {
    if (jsel.match('.Code:val("InvalidGroup.NotFound")', r).length) {
      aws.call('CreateSecurityGroup', {
        GroupName: groupName,
        GroupDescription: 'A security group for browserid deployments'
      }, function(r) {
        if (!r || !r.return === 'true') {
          return cb(createError('failed to create security group', r));
        }
        aws.call('AuthorizeSecurityGroupIngress', {
          GroupName: groupName,
          "IpPermissions.1.IpProtocol": 'tcp',
          "IpPermissions.1.FromPort": 80,
          "IpPermissions.1.ToPort": 80,
          "IpPermissions.1.IpRanges.1.CidrIp": "0.0.0.0/0",
          "IpPermissions.2.IpProtocol": 'tcp',
          "IpPermissions.2.FromPort": 22,
          "IpPermissions.2.ToPort": 22,
          "IpPermissions.2.IpRanges.1.CidrIp": "0.0.0.0/0",
          "IpPermissions.3.IpProtocol": 'tcp',
          "IpPermissions.3.FromPort": 443,
          "IpPermissions.3.ToPort": 443,
          "IpPermissions.3.IpRanges.1.CidrIp" : "0.0.0.0/0"
        }, function(r) {
          if (!r || !r.return === 'true') {
            return cb(createError('failed to create security group', r));
          }
          cb(null, groupName);
        });
      });
    } else {
      // already exists?
      var m = jsel.match('.securityGroupInfo > .item > .groupName', r);
      if (m.length && m[0] === groupName) return cb(null, groupName);
      cb(createError('error creating group', r));
    }
  });
};
