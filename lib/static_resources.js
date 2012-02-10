
const resources = {
  '/production/dialog.css': [
    '/css/common.css',
    '/dialog/css/popup.css',
    '/dialog/css/m.css'
  ],
  '/production/:locale:/dialog.js': [
    "/lib/jquery-1.7.1.min.js",
    "/lib/winchan.js",
    "/lib/underscore-min.js",
    "/lib/vepbundle.js",
    "/lib/ejs.js",
    "/shared/javascript-extensions.js",
    "/i18n/:locale:/client.json",
    "/shared/gettext.js",
    "/shared/browserid.js",
    "/lib/hub.js",
    "/lib/dom-jquery.js",
    "/lib/module.js",
    "/lib/jschannel.js",
    "/shared/templates.js",
    "/shared/renderer.js",
    "/shared/class.js",
    "/shared/mediator.js",
    "/shared/tooltip.js",
    "/shared/validation.js",
    "/shared/helpers.js",
    "/shared/screens.js",
    "/shared/browser-support.js",
    "/shared/wait-messages.js",
    "/shared/error-messages.js",
    "/shared/error-display.js",
    "/shared/storage.js",
    "/shared/xhr.js",
    "/shared/network.js",
    "/shared/provisioning.js",
    "/shared/user.js",
    "/shared/command.js",
    "/shared/history.js",
    "/shared/state_machine.js",
    "/shared/modules/page_module.js",
    "/shared/modules/xhr_delay.js",
    "/shared/modules/xhr_disable_form.js",
    "/shared/modules/cookie_check.js",
    "/dialog/resources/internal_api.js",
    "/dialog/resources/helpers.js",
    "/dialog/resources/state.js",
    "/dialog/controllers/actions.js",
    "/dialog/controllers/dialog.js",
    "/dialog/controllers/authenticate.js",
    "/dialog/controllers/forgot_password.js",
    "/dialog/controllers/check_registration.js",
    "/dialog/controllers/pick_email.js",
    "/dialog/controllers/add_email.js",
    "/dialog/controllers/required_email.js",
    "/dialog/controllers/verify_primary_user.js",
    "/dialog/controllers/provision_primary_user.js",
    "/dialog/controllers/primary_user_provisioned.js",
    "/dialog/controllers/email_chosen.js",
    "/dialog/start.js"
  ]
};

// return all filenames of static resources we serve
// locales is an array of supported locales
exports.all = function(locales) {

};

// get all resource urls for a specified resource
exports.getResources(path, locale) {
  var res = [];
  path = path.replace(locale, ':locale:');
  if (resources[path]) {
    resources[path].forEach(function(r) {
      res.push(r.replace(':locale:', r));
    });
  }
  return res;
};

