var vows = require('vows'),
    path = require('path'),
    assert = require('assert');

module.exports = function(spec, mod) {
  var suite = vows.describe(path.basename(process.argv[1]));
  suite.options.error = false;

  var lastArgs = [];
  Object.keys(spec).forEach(function(name) {
    var obj = {};
    obj[name] = {
      topic: function() {
        var self = this;
        var args = lastArgs.slice(1);
        // add a "done" function as the first argument
        args.unshift(function() {
          // invoke callback with all these arguments
          lastArgs = Array.prototype.slice.call(arguments, 0);
          self.callback.apply(self, lastArgs);
        });
        spec[name].apply(this, args);
      },
      "succeeds": function(err) {
        assert(!err, err);
      }
    };
    suite.addBatch(obj);
  });

  if (process.argv[1] === __filename) suite.run();
  else suite.export(mod);
};
