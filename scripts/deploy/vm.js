const
aws = require('./aws.js');
jsel = require('JSONSelect'),
key = require('./key.js');

const BROWSERID_TEMPLATE_IMAGE_ID = 'ami-51ac7d38';

function extractInstanceDeets(horribleBlob) {
  var instance = {};
  ["instanceId", "imageId", "instanceState", "dnsName", "keyName", "instanceType",
   "ipAddress"].forEach(function(key) {
     if (horribleBlob[key]) instance[key] = horribleBlob[key];
   });
  return instance;
}

exports.list = function(cb) {
  aws.call('DescribeInstances', {}, function(result) {
    var instances = [];
    jsel.forEach(".instancesSet > .item", result, function(item) {
      instances.push(extractInstanceDeets(item));
    });
    cb(null, instances);
  });
};

function returnSingleImageInfo(result, cb) {
  if (!result) return cb('no results from ec2 api');
  try { return cb(result.Errors.Error.Message); } catch(e) {};
  try { 
    result = jsel.match(".instancesSet > .item", result)[0];
    cb(null, extractInstanceDeets(result));
  } catch(e) {
    return cb("couldn't extract new instance details from ec2 response: " + e);
  } 
}

exports.startImage = function(cb) {
  key.getName(function(err, r) {
    if (err) return cb(err);
    aws.call('RunInstances', {
      ImageId: BROWSERID_TEMPLATE_IMAGE_ID,
      KeyName: r,
      InstanceType: 't1.micro',
      MinCount: 1,
      MaxCount: 1
    }, function (result) {
      returnSingleImageInfo(result, cb);
    });
  });
};

exports.waitForInstance = function(id, cb) {
  aws.call('DescribeInstanceStatus', {
    InstanceId: id
  }, function(r) {
    if (!r) return cb('no response from ec2');
    if (!r.instanceStatusSet) return cb('malformed response from ec2');
    if (Object.keys(r.instanceStatusSet).length) {
      var deets = extractInstanceDeets(r.instanceStatusSet.item);
      if (deets && deets.instanceState && deets.instanceState.name === 'running') {
        return aws.call('DescribeInstances', { InstanceId: id }, function(result) {
          returnSingleImageInfo(result, cb);
        });
      }
    }
    setTimeout(function(){ exports.waitForInstance(id, cb); }, 1000);
  });
};
