const
db = require('../db.js'),
wsapi = require('../wsapi.js');

exports.method = 'get';
exports.writes_db = false;
exports.authed = false;
exports.args = ['email'];

exports.process = function(req, res) {
  var email = req.query.email;

  // if the user is authenticated as the user in question, we're done
  if (wsapi.isAuthed(req) && req.session.authenticatedUser === email) {
    return res.json({ status: 'complete' });
  }
  // if the user isn't authenticated and there's no pendingCreation token,
  // then they must authenticate
  else if (!req.session.pendingCreation) {
    return res.json({ status: 'mustAuth' });
  }

  // if the secret is still in the database, it hasn't yet been verified and
  // verification is still pending
  db.emailForVerificationSecret(req.session.pendingCreation, function (email) {
    if (email) return res.json({ status: 'pending' });
    // if the secret isn't known, and we're not authenticated, then the user must authenticate
    // (maybe they verified the URL on a different browser, or maybe they canceled the account
    // creation)
    else {
      delete req.session.pendingCreation;
      res.json({ status: 'mustAuth' });
    }
  });
};
