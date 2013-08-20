/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

module.exports = function boolean_query(req, res, next) {
  Object.keys(req.query).forEach(function(key) {
    if (req.query[key] === "true") req.query[key] = true;
    else if (req.query[key] === "false") req.query[key] = false;
  });

  next();
};
