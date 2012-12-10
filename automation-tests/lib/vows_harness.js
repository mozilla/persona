var vows = require('vows'),
    path = require('path'),
    assert = require('assert');

module.exports = function(spec, mod, opts) {
  opts = opts || {};
  // bail on error means halt tests at first failure
  if (opts.bailOnError === undefined) opts.bailOnError = true;
  // if a .cleanup function is supplied, it will be invoked after
  // all tests are run

  var suite = vows.describe(opts.suiteName || path.basename(process.argv[1]));
  suite.options.error = false;

  var lastArgs = [];
  var failedState = false;
  Object.keys(spec).forEach(function(name) {
    var myNumber = suite.batches.length + 1;
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

        if (!opts.bailOnError || !failedState) {
          spec[name].apply(this, args);
        } else {
          this.callback(null);
        }
      },
      "succeeds": function(err) {
        if (opts.bailOnError && err) {
          failedState = true;
          // halt processing of subsequent batches (except for the cleanup batch,
          // which is why we have a '- 1')
          for (var i = myNumber; i < suite.batches.length - 1; i++) {
            suite.batches[i].pending = suite.batches[i].total;
            suite.batches[i].remaining = 0;
          }
        }
        if (err) assert.fail(err);
      }
    };
    suite.addBatch(obj);
  });

  // now add cleanup invocation as a batch

  if (opts.cleanup) {
    suite.addBatch({
      "cleanup": {
        topic: function() {
          opts.cleanup(this.callback);
        },
        "done": function() { }
      }
    });
  }

  if (path.basename(process.argv[1]) === 'vows') {
    suite.export(mod);
  } else {
    suite.run({});
  }
};
