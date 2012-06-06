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
    Gettext = require('node-gettext'),
    path = require('path'),
    util = require('util'),
    fs = require('fs');

const BIDI_RTL_LANGS = ['ar', 'db-LB', 'fa', 'he'];

var mo_cache = {};

/**
 * Connect middleware which is i18n aware.
 *
 * Usage:
  app.use(i18n.abide({
    supported_languages: ['en-US', 'fr', 'pl'],
    default_lang: 'en-US',
    locale_directory: 'locale'
  }));
 *
 * Other valid options: gettext_alias, ngettext_alias
 */
exports.abide = function (options) {

  if (! options.gettext_alias)        options.gettext_alias = 'gettext';
  if (! options.ngettext_alias)       options.ngettext_alias = 'ngettext';
  if (! options.supported_languages)  options.supported_languages = ['en-US'];
  if (! options.default_lang)         options.default_lang = 'en-US';
  if (! options.debug_lang)           options.debug_lang = 'it-CH';
  if (! options.disable_locale_check) options.disable_locale_check = false;
  if (! options.locale_directory)     options.locale_directory = 'locale';
  if (! options.i18n_json_dir)        options.i18n_json_dir = 'resources/static/i18n/';

  var mo_file_path = function (locale) {
        return path.resolve(
             path.join(__dirname, '..'),
                       options.locale_directory,
                       path.join(locale, 'LC_MESSAGES', 'messages.mo'));
      },
      json_file_path = function (locale) {
        return path.resolve(
             path.join(__dirname, '..'),
                       path.join(options.i18n_json_dir, locale, 'client.json'));
      },
      debug_locale = localeFrom(options.debug_lang);

  options.supported_languages.forEach(function (lang, i) {
    var l = localeFrom(lang),
        default_locale = localeFrom(options.default_lang);

    mo_cache[l] = {
      mo_exists: path.existsSync(mo_file_path(l)),
      json_exists: path.existsSync(json_file_path(l)),
      gt: null
    };
    if (l !== debug_locale) {
      if (! mo_cache[l] || ! mo_cache[l].mo_exists || ! mo_cache[l].json_exists) {
        var msg = util.format('Bad locale=[%s] file(s) do not exist [%s] or [%s]. See locale/README',
                              l, mo_file_path(l), json_file_path(l));
        if (mo_cache[l].json_exists && l == default_locale) {
          // mo files aren't critical... carry on
          if (! options.disable_locale_check) logger.warn(msg);
        } else {
          logger.error(msg);
          throw msg;
        }
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

    if (lang && lang.toLowerCase && lang.toLowerCase() == debug_lang) {
        lang = 'db-LB'; // What? http://www.youtube.com/watch?v=rJLnGjhPT1Q
    }

    resp.local('lang', lang);

    // BIDI support, which direction does text flow?
    lang_dir = BIDI_RTL_LANGS.indexOf(lang) >= 0 ? 'rtl' : 'ltr';
    resp.local('lang_dir', lang_dir);
    req.lang = lang;

    locale = localeFrom(lang);

    resp.local('locale', locale);
    req.locale = locale;

    resp.local('format', format);
    req.format = format;

    if (mo_cache[locale].mo_exists) {
      if (mo_cache[locale].gt === null) {
        mo_cache[locale].gt = new Gettext();
        mo_path = mo_file_path(locale);
        mo_cache[locale].gt.addTextdomain(locale,
                                           fs.readFileSync(mo_path));
        mo_cache[locale].gt.textdomain(locale);
      }
      var gt = mo_cache[locale].gt;
      resp.local(options.gettext_alias, gt.gettext.bind(gt));
      req.gettext = gt.gettext.bind(gt);
      resp.local(options.ngettext_alias, gt.ngettext.bind(gt));
      req.ngettext = gt.ngettext.bind(gt);
   } else {
      // en-US in a non gettext environment... fake it
      var identity = function (a, b) { return a; };
      resp.local(options.gettext_alias, identity);
      req.gettext = identity;
      resp.local(options.ngettext_alias, identity);
      req.ngettext = identity;
    }
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
exports.parseAcceptLanguage = parseAcceptLanguage = function (header) {
    // pl,fr-FR;q=0.3,en-US;q=0.1
    if (! header || ! header.split) {
      return [];
    }
    var raw_langs = header.split(',');
    var langs = raw_langs.map(function (raw_lang) {
      var parts = raw_lang.split(';');
      var q = 1;
      if (parts.length > 1 && parts[1].indexOf('q=') == 0) {
          qval = parseFloat(parts[1].split('=')[1]);
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
exports.bestLanguage = bestLanguage = function(languages, supported_languages, defaultLanguage) {
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
exports.localeFrom = localeFrom = function (language) {
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
 * format("%(salutation)s %(place)s", {salutation: "Hello", place: "World"}, true);
 * Positional Example:
 * format("%s %s", ["Hello", "World"]);
 */
exports.format = format = function (fmt, obj, named) {
  if (! fmt) return "";
  if (named) {
    return fmt.replace(/%\(\w+\)s/g, function(match){return String(obj[match.slice(2,-2)])});
  } else {
    return fmt.replace(/%s/g, function(match){return String(obj.shift())});
  }
};
