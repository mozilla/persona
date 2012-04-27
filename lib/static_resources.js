var i18n = require('./i18n'),
    und = require('underscore');

/**
 * Module for managing all the known static assets in browserid.
 * In filenames/paths below, you may use ``:locale`` as a url
 * variable to be expanded later.
 *
 * These settings affect usage of cachify and eventually our
 * asset build steps.
 *
 * Be careful editing common_js, as it will affect all
 * minified scripts that depend on that variable. IE re-ordering
 * the list or removing a script.
 */

// Common to browserid.js dialog.js
var common_js = [
  '/lib/jquery-1.7.1.min.js',
  '/lib/winchan.js',
  '/lib/underscore-min.js',
  '/lib/vepbundle.js',
  '/lib/ejs.js',
  '/lib/micrajax.js',
  '/shared/javascript-extensions.js',
  '/i18n/:locale/client.json',
  '/shared/gettext.js',
  '/shared/browserid.js',
  '/lib/hub.js',
  '/lib/dom-jquery.js',
  '/lib/module.js',
  '/lib/jschannel.js',
  '/shared/templates.js',
  '/shared/renderer.js',
  '/shared/class.js',
  '/shared/mediator.js',
  '/shared/tooltip.js',
  '/shared/validation.js',
  '/shared/helpers.js',
  '/shared/screens.js',
  '/shared/browser-support.js',
  '/shared/enable_cookies_url.js',
  '/shared/wait-messages.js',
  '/shared/error-messages.js',
  '/shared/error-display.js',
  '/shared/storage.js',
  '/shared/xhr_transport.js',
  '/shared/xhr.js',
  '/shared/network.js',
  '/shared/provisioning.js',
  '/shared/user.js',
  '/shared/modules/page_module.js',
  '/shared/modules/xhr_delay.js',
  '/shared/modules/xhr_disable_form.js',
  '/shared/modules/cookie_check.js'
];

var browserid_min_js = '/production/:locale/browserid.js';
var browserid_js = und.flatten([
  common_js,
  [
    '/pages/page_helpers.js',
    '/pages/index.js',
    '/pages/start.js',
    '/pages/add_email_address.js',
    '/pages/verify_email_address.js',
    '/pages/forgot.js',
    '/pages/manage_account.js',
    '/pages/signin.js',
    '/pages/signup.js'
  ]
]);

var dialog_min_js = '/production/:locale/dialog.js';
var dialog_js = und.flatten([
  common_js,
  [
    '/lib/urlparse.js',

    '/shared/command.js',
    '/shared/history.js',
    '/shared/state_machine.js',

    '/dialog/resources/internal_api.js',
    '/dialog/resources/helpers.js',
    '/dialog/resources/state.js',
    '/dialog/resources/screen_size_hacks.js',

    '/dialog/controllers/actions.js',
    '/dialog/controllers/dialog.js',
    '/dialog/controllers/authenticate.js',
    '/dialog/controllers/forgot_password.js',
    '/dialog/controllers/check_registration.js',
    '/dialog/controllers/pick_email.js',
    '/dialog/controllers/add_email.js',
    '/dialog/controllers/required_email.js',
    '/dialog/controllers/verify_primary_user.js',
    '/dialog/controllers/provision_primary_user.js',
    '/dialog/controllers/primary_user_provisioned.js',
    '/dialog/controllers/generate_assertion.js',
    '/dialog/controllers/is_this_your_computer.js',

    '/dialog/start.js'
  ]]);

exports.resources = {
  '/production/dialog.css': [
    '/css/common.css',
    '/dialog/css/popup.css',
    '/dialog/css/m.css'
  ],
  '/production/browserid.css': [
    '/css/common.css',
    '/css/style.css',
    '/css/m.css'
  ],
  '/production/communication_iframe.js': [
    '/lib/jschannel.js',
    '/lib/winchan.js',
    '/lib/underscore-min.js',
    '/lib/vepbundle.js',
    '/lib/hub.js',
    '/lib/micrajax.js',
    '/shared/javascript-extensions.js',
    '/shared/browserid.js',
    '/shared/mediator.js',
    '/shared/helpers.js',
    '/shared/storage.js',
    '/shared/xhr_transport.js',
    '/shared/xhr.js',
    '/shared/network.js',
    '/shared/user.js',
    '/communication_iframe/start.js'
  ],
  '/production/include.js': [
    '/include_js/include.js'
  ]
};
exports.resources[dialog_min_js] = dialog_js;
exports.resources[browserid_min_js] = browserid_js;

var replace = function(path, locale) { return path.replace(':locale', locale); };

/**
 * Returns all filenames of static resources
 * in a connect-cachify compatible format.
 *
 * @langs - array of languages we support
 * @return { minified_file: [dependent, files] }
 *
 * Languages will be converted to locales. Filenames and list of files
 * will be expanded to match all the permutations.
 */
exports.all = function(langs) {
  var res = {};
  for (var f in exports.resources) {
    langs.forEach(function (lang) {
      var l = i18n.localeFrom(lang);
      res[replace(f, l)] = getResources(f, l);
    });
  }
  return res;
};

/**
 * Get all resource urls for a specified resource based on the locale
 */
exports.getResources = getResources = function(path, locale) {
  var res = [];
  if (exports.resources[path]) {
    exports.resources[path].forEach(function(r) {
      res.push(replace(r, locale));
    });
  }
  return res;
};
