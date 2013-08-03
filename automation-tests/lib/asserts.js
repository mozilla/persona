// desc is optional textual description of the error
exports.ok = function(fact, desc) { 
  var defaultMsg = "assertion failed: '" + fact + "' is not truthy";
  if (!fact) return desc || defaultMsg;
};
exports.equal = function(lhs, rhs, desc) { 
  var defaultMsg = "assertion failed: actual '" + lhs 
                 + "' does not equal expected '" + rhs + "'";
  if (lhs !== rhs) return desc || defaultMsg;
};
