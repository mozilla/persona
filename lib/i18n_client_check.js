/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * i18n-abide
 *
 * This module abides by the user's language preferences and makes it
 * available throughout the app.
 *
 * This module abides by the Mozilla L10n way of doing things.
 *
 * The module abides.
 *
 * See docs/I18N.md for details.
 */

var config = require('./configuration.js'),
    fs = require('fs'),
    i18n = require('i18n-abide'),
    logger = require('./logging.js').logger,
    path = require('path'),
    util = require('util');

// existsSync moved from path in 0.6.x to fs in 0.8.x
var existsSync = fs.existsSync || path.existsSync;

module.exports = function() {
  var json_dir = config.get('translation_directory');

  var langs = config.get('supported_languages');
  langs.forEach(function(lang) {
    var l = i18n.localeFrom(lang);
    try {
      // This verification is BrowserID specific, not i18n-abide specific...
      // Or... maybe i18n-abide can take a list of catalogs
      // mozilla/i18n-abide/issues/20

      // verify that client.json is present
      if (!existsSync(path.join(json_dir, l, 'client.json'))) {
        throw 'client.json';
      }
    } catch(e) {
      // an exception here means that there was a problem with the translation files for
      // this locale!
      var msg = util.format('Bad locale=[%s] missing .json files in [%s]. See locale/README (%s)',
                            l, path.join(json_dir, l), e);
      if (!config.get('disable_locale_check')) {
        logger.warn(msg);
      } else {
        logger.error(msg);
        throw msg;
      }
    }
  });
};