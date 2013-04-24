exports.DEFAULT_POLL_MS = 5000;
exports.DEFAULT_TIMEOUT_MS = 40000;
// At the advice of the WebQA team, setting the default implicit wait to 0 and
// using explicit waits. This helps reduce the number of errors due to explicit
// timeouts.

// nope. try bumping implicit wait for phantom to wait for webkit.
exports.DEFAULT_IMPLICIT_WAIT_MS = 2000;
