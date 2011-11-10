const
db = require('../db.js'),
logger = require('../logging.js').logger,
crypto = require('crypto'),
wsapi = require('../wsapi.js');

// return the CSRF token, authentication status, and current server time (for assertion signing)
// IMPORTANT: this is safe because it's only readable by same-origin code

exports.method = 'get';
exports.writes_db = false;
exports.authed = false;

exports.process = function(req, res) {
  if (typeof req.session == 'undefined') {
    req.session = {};
  }

  if (typeof req.session.csrf == 'undefined') {
    // FIXME: using express-csrf's approach for generating randomness
    // not awesome, but probably sufficient for now.
    req.session.csrf = crypto.createHash('md5').update('' + new Date().getTime()).digest('hex');
    logger.debug("NEW csrf token created: " + req.session.csrf);
  }

  var auth_status = false;

  function sendResponse() {
    res.json({
      csrf_token: req.session.csrf,
      server_time: (new Date()).getTime(),
      authenticated: auth_status
    });
  };

  // if they're authenticated for an email address that we don't know about,
  // then we should purge the stored cookie
  if (!wsapi.isAuthed(req)) {
    logger.debug("user is not authenticated");
    sendResponse();
  } else {
    db.emailKnown(req.session.authenticatedUser, function (known) {
      if (!known) {
        logger.debug("user is authenticated with an email that doesn't exist in the database");
        wsapi.clearAuthenticatedUser(req.session);
      } else {
        logger.debug("user is authenticated");
        auth_status = true;
      }
      sendResponse();
    });
  }
};
