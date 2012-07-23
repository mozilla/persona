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

var logger = require('./logging.js').logger,
    path = require('path'),
    util = require('util'),
    fs = require('fs'),
    gobbledygook = require('gobbledygook');

// existsSync moved from path in 0.6.x to fs in 0.8.x
if (typeof fs.existsSync === 'function') {
  var existsSync = fs.existsSync;
} else {
  var existsSync = path.existsSync;
}

const BIDI_RTL_LANGS = ['ar', 'fa', 'he'];

var translations = {};

/**
 * Connect middleware which is i18n aware.
 *
 * Usage:
  app.use(i18n.abide({
    supported_languages: ['en-US', 'fr', 'pl'],
    default_lang: 'en-US',
  }));
 *
 * Other valid options: gettext_alias, ngettext_alias
 */
exports.abide = function (options) {
  if (! options.gettext_alias)          options.gettext_alias = 'gettext';
  if (! options.supported_languages)    options.supported_languages = ['en-US'];
  if (! options.default_lang)           options.default_lang = 'en-US';
  if (! options.debug_lang)             options.debug_lang = 'it-CH';
  if (! options.disable_locale_check)   options.disable_locale_check = false;
  if (! options.translation_directory)  options.i18n_json_dir = 'l10n/';

  var json_dir = path.resolve(
          path.join(__dirname, '..'),
          path.join(options.translation_directory));

  var debug_locale = localeFrom(options.debug_lang);

  options.supported_languages.forEach(function (lang, i) {
    // ignore .json files for default and debug languages
    if (options.default_lang == lang || options.debug_lang == lang) return;

    var l = localeFrom(lang);

    try {
      // populate the in-memory translation cache with client.json, which contains
      // strings relevant on the server

      // XXX: these files should be json.  not javascript.
      var json_locale_data; // for jshint
      eval(fs.readFileSync(path.join(json_dir, l, 'messages.json')).toString());
      translations[l] = json_locale_data.messages;

      // verify that client.json is present
      if (!existsSync(path.join(json_dir, l, 'client.json'))) {
        throw 'client.json';
      }
    } catch(e) {
      // an exception here means that there was a problem with the translation files for
      // this locale!
      var msg = util.format('Bad locale=[%s] missing .json files in [%s]. See locale/README (%s)',
                            l, path.join(json_dir, l), e);
      if (!options.disable_locale_check) {
        logger.warn(msg);
      } else {
        logger.error(msg);
        throw msg;
      }
    }
  });

  return function(req, resp, next) {
    var langs = parseAcceptLanguage(req.headers['accept-language']),
        lang_dir,
        lang = bestLanguage(langs, options.supported_languages,
                            options.default_lang),
        debug_lang = options.debug_lang.toLowerCase(),
        locale;

    resp.local('lang', lang);

    // BIDI support, which direction does text flow?
    lang_dir = ((BIDI_RTL_LANGS.indexOf(lang) >= 0) || debug_lang == lang.toLowerCase()) ? 'rtl' : 'ltr';
    resp.local('lang_dir', lang_dir);
    req.lang = lang;

    locale = localeFrom(lang);

    resp.local('locale', locale);
    req.locale = locale;

    resp.local('format', format);
    req.format = format;

    var gt;

    if (lang.toLowerCase() === debug_lang) {
      gt = gobbledygook;
      resp.local('lang', 'db-LB');
    } else if (translations[locale]) {
      gt = function(sid) {
        if (translations[locale][sid] && translations[locale][sid][1].length) {
          sid = translations[locale][sid][1];
        }
        return sid;
      };
    } else {
      gt = function(a) { return a; }
    }
    resp.local(options.gettext_alias, gt);
    req.gettext = gt;

    next();
  };
};
function qualityCmp(a, b) {
  if (a.quality == b.quality) {
    return 0;
  } else if (a.quality < b.quality) {
    return 1;
  } else {
    return -1;
  }
};

/**
 * Parses the HTTP accept-language header and returns a
 * sorted array of objects. Example object:
 * {
 *   lang: 'pl', quality: 0.7
 * }
 */
var parseAcceptLanguage = exports.parseAcceptLanguage = function (header) {
    // pl,fr-FR;q=0.3,en-US;q=0.1
    if (! header || ! header.split) {
      return [];
    }
    var raw_langs = header.split(',');
    var langs = raw_langs.map(function (raw_lang) {
      var parts = raw_lang.split(';');
      var q = 1;
      if (parts.length > 1 && parts[1].indexOf('q=') == 0) {
          var qval = parseFloat(parts[1].split('=')[1]);
          if (isNaN(qval) === false) {
            q = qval;
          }
      }
      return { lang: parts[0].trim(), quality: q };
    });
    langs.sort(qualityCmp);
    return langs;
};


 // Given the user's prefered languages and a list of currently
 // supported languages, returns the best match or a default language.
 //
 // languages must be a sorted list, the first match is returned.
var bestLanguage = exports.bestLanguage = function(languages, supported_languages, defaultLanguage) {
  var lower = supported_languages.map(function (l) { return l.toLowerCase(); });
  for(var i=0; i < languages.length; i++) {
    var lq = languages[i];
    if (lower.indexOf(lq.lang.toLowerCase()) !== -1) {
      return lq.lang;
    // Issue#1128 match locale, even if region isn't supported
    } else if (lower.indexOf(lq.lang.slice(0, 2).toLowerCase()) !== -1) {
      return lq.lang.slice(0, 2);
    }
  }
  return defaultLanguage;
};

/**
 * Given a language code, return a locale code the OS understands.
 *
 * language: en-US
 * locale:   en_US
 */
var localeFrom = exports.localeFrom = function (language) {
  if (! language || ! language.split) {
      return "";
  }
  var parts = language.split('-');
  if (parts.length === 1) {
    return parts[0].toLowerCase();
  } else if (parts.length === 2) {
    return util.format('%s_%s', parts[0].toLowerCase(), parts[1].toUpperCase());
  } else if (parts.length === 3) {
    // sr-Cyrl-RS should be sr_RS
    return util.format('%s_%s', parts[0].toLowerCase(), parts[2].toUpperCase());
  } else {
    logger.error(util.format("Unable to map a local from language code [%s]", language));
    return language;
  }
};

/**
 * Given a locale code, return a language code
 */
exports.languageFrom = function (locale) {
  if (!locale || !locale.split) {
    return "";
  }
  var parts = locale.split('_');
  if (parts.length === 1) {
    return parts[0].toLowerCase();
  } else if (parts.length === 2) {
    return util.format('%s-%s', parts[0].toLowerCase(), parts[1].toUpperCase());
  } else if (parts.length === 3) {
    // sr_RS should be sr-RS
    return util.format('%s-%s', parts[0].toLowerCase(), parts[2].toUpperCase());
  } else {
    logger.error(util.format("Unable to map a language from locale code [%s]", locale));
    return locale;
  }
}

/**
 * format provides string interpolation on the client and server side.
 * It can be used with either an object for named variables, or an array
 * of values for positional replacement.
 *
 * Named Example:
 * format("%(salutation)s %(place)s", {salutation: "Hello", place: "World"});
 * Positional Example:
 * format("%s %s", ["Hello", "World"]);
 */
var format = exports.format = function (fmt, obj, named) {
  if (!fmt) return "";
  if (Array.isArray(obj) || named === false) {
    return fmt.replace(/%s/g, function(match){return String(obj.shift())});
  } else if (typeof obj === 'object' || named === true) {
    return fmt.replace(/%\(\s*([^)]+)\s*\)/g, function(m, v){
      return String(obj[v]);
    });
  } else {
    return fmt;
  }
};
