const
wsapi = require('../wsapi.js');

exports.method = 'post';
exports.writes_db = false;
exports.authed = 'assertion';
exports.i18n = false;

exports.process = function(req, res) {
  wsapi.clearAuthenticatedUser(req.session);
  res.json({ success: true });
};
