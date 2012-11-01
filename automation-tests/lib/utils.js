// wait for something to work.
//   poll - how often to check in ms
//   timeout - how long to try before giving up in ms
//   check - a function that will perform the check, accepts a callback where the
//           first argument is a boolean indicating whether the check was successful
//           (if false, the check will be retried)
//   complete - a callback to invoke upon timeout or successful check with args.slice(1)
//           from the check function
exports.waitFor = function (poll, timeout, check, complete) {
  var startTime = new Date();
  function doit() {
    check(function(done) {
      if (!done && ((new Date() - startTime) > timeout)) {
        complete.call(null, "timeout hit");
      } else if (done) {
        complete.apply(null, Array.prototype.slice.call(arguments, 1));
      } else {
        setTimeout(doit, poll);
      }
    });
  }
  setTimeout(doit, poll);
};
