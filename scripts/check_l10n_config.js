var fs = require('fs'),
    i18n = require('i18n-abide'),
    path = require('path'),
    util = require('util');

if (! process.env['CONFIG_FILES']) {
  console.error("You must set CONFIG_FILES to point to the json file you want to check");
  process.exit(1);
}

var config = require('../lib/configuration.js'),
    error = 0,
    logged = false;

console.log("Checking ", config.get('supported_languages').length, "languages from ", process.env['CONFIG_FILES']);

config.get('supported_languages').forEach(function (lang, i) {
  var locale = i18n.localeFrom(lang);
  if (i18n.languageFrom(locale) !== lang) {
    console.error("Hmmm language=", lang, "seems fishy! Converts to locale=",
      locale, " and back again into language=", i18n.languageFrom(locale));
    error = 1;
  }
  path.exists(path.join(__dirname, '..', 'locale', locale, 'LC_MESSAGES', 'messages.po'), function (m_exists) {
    if (! m_exists) {
      console.error("Language ", lang, " doesn't exist. Expected",
        path.join(__dirname, '..', 'locale', locale, 'LC_MESSAGES', 'messages.po'));
      error = 1;
    }
  });
});

process.on('exit', function () {
  // This will run twice...
  if (! logged) {
    logged = true;
    if (error === 0) {
      console.log("OK");
    } else {
      console.log("FAIL");
    }
  }
  process.exit(error);
});