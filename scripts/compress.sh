#!/bin/sh
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


cd $(dirname "$0")/..

export PATH=$PWD/node_modules/.bin:$PATH


UGLIFY=`which uglifyjs 2> /dev/null`
if [ ! -x "$UGLIFY" ]; then
    echo "uglifyjs not found in your path.  Have you npm installed lately?"
    exit 1
fi

UGLIFYCSS=`which uglifycss 2> /dev/null`
if [ ! -x "$UGLIFY" ]; then
    echo "uglifycss not found in your path.  Have you npm installed lately?"
    exit 1
fi

UGLIFYCSS=`pwd`'/node_modules/uglifycss/uglifycss'

#set up the path of where all build resources go.
BUILD_PATH=`pwd`'/resources/static/build'
if [ ! -x "$BUILD_PATH" ]; then
    echo "****Creating build JS/CSS directory.****"
    mkdir $BUILD_PATH
fi

#set up the path of where all production resources go.
PRODUCTION_PATH=`pwd`'/resources/static/production'
if [ ! -x "$PRODUCTION_PATH" ]; then
    echo "****Creating production JS/CSS directory.****"
    mkdir $PRODUCTION_PATH
fi

set -e  # exit on errors

echo ''
echo '****Copy include.js****'
echo ''
cd resources/static
cp include_js/include.js $BUILD_PATH/include.uncompressed.js

echo ''
echo '****Building dialog HTML, CSS, and JS****'
echo ''

## This creates a combined templates file which is copied into
## resources/templates.js and included into the minified bundle.

cd dialog/views
../../../../scripts/create_templates.js
cp templates.js $BUILD_PATH/templates.js
cd ../..

# produce the dialog js
locales=`../../scripts/production_locales`
echo "generating for the following locales:"
echo $locales

for locale in $locales; do
    mkdir -p $BUILD_PATH/$locale
    cat lib/jquery-1.7.1.min.js lib/winchan.js lib/underscore-min.js lib/vepbundle.js lib/ejs.js shared/javascript-extensions.js i18n/${locale}/client.json shared/gettext.js shared/browserid.js lib/hub.js lib/dom-jquery.js lib/module.js lib/jschannel.js $BUILD_PATH/templates.js shared/renderer.js shared/class.js shared/mediator.js shared/tooltip.js shared/validation.js shared/helpers.js shared/screens.js shared/browser-support.js shared/wait-messages.js shared/error-messages.js shared/error-display.js shared/storage.js shared/xhr.js shared/network.js shared/provisioning.js shared/user.js shared/modules/page_module.js shared/modules/xhr_delay.js shared/modules/xhr_disable_form.js shared/modules/code_check.js shared/modules/cookie_check.js dialog/resources/internal_api.js dialog/resources/helpers.js dialog/resources/state_machine.js dialog/controllers/actions.js dialog/controllers/dialog.js dialog/controllers/authenticate.js dialog/controllers/forgot_password.js dialog/controllers/check_registration.js dialog/controllers/pick_email.js dialog/controllers/add_email.js dialog/controllers/required_email.js dialog/controllers/verify_primary_user.js dialog/controllers/provision_primary_user.js dialog/controllers/primary_user_provisioned.js dialog/controllers/email_chosen.js dialog/start.js > $BUILD_PATH/$locale/dialog.uncompressed.js
done

# produce the dialog css
cat css/common.css dialog/css/popup.css dialog/css/m.css > $BUILD_PATH/dialog.uncompressed.css

# produce the non interactive frame js
cat lib/jquery-1.7.1.min.js lib/jschannel.js lib/winchan.js lib/underscore-min.js lib/vepbundle.js shared/javascript-extensions.js shared/browserid.js shared/storage.js shared/xhr.js shared/network.js shared/user.js communication_iframe/start.js > $BUILD_PATH/communication_iframe.uncompressed.js

echo ''
echo '****Building BrowserID.org HTML, CSS, and JS****'
echo ''

#produce the main site js
for locale in $locales; do
    cat lib/vepbundle.js lib/jquery-1.7.1.min.js lib/underscore-min.js lib/ejs.js shared/javascript-extensions.js i18n/${locale}/client.json shared/gettext.js shared/browserid.js lib/dom-jquery.js lib/module.js lib/jschannel.js lib/winchan.js lib/hub.js $BUILD_PATH/templates.js shared/renderer.js shared/class.js shared/mediator.js shared/tooltip.js shared/validation.js shared/helpers.js shared/screens.js shared/browser-support.js shared/wait-messages.js shared/error-messages.js shared/error-display.js shared/storage.js shared/xhr.js shared/network.js shared/provisioning.js shared/user.js shared/modules/page_module.js shared/modules/xhr_delay.js shared/modules/xhr_disable_form.js shared/modules/code_check.js shared/modules/cookie_check.js pages/page_helpers.js pages/start.js pages/index.js pages/add_email_address.js pages/verify_email_address.js pages/forgot.js pages/manage_account.js pages/signin.js pages/signup.js > $BUILD_PATH/$locale/browserid.uncompressed.js
done


# produce the main site css
cat css/common.css css/style.css css/m.css > $BUILD_PATH/browserid.uncompressed.css

echo ''
echo '****Compressing all JS, CSS****'
echo ''

cd $PRODUCTION_PATH

pwd 
# minify the JS
$UGLIFY < $BUILD_PATH/include.uncompressed.js > include.js
for locale in `../../../scripts/production_locales`; do
    mkdir -p $locale
    $UGLIFY < $BUILD_PATH/$locale/dialog.uncompressed.js > $locale/dialog.js
    $UGLIFY < $BUILD_PATH/$locale/browserid.uncompressed.js > $locale/browserid.js
done
$UGLIFY < $BUILD_PATH/communication_iframe.uncompressed.js > communication_iframe.js


# minify the CSS
$UGLIFYCSS $BUILD_PATH/browserid.uncompressed.css > browserid.css
$UGLIFYCSS $BUILD_PATH/dialog.uncompressed.css > dialog.css

# set up new simlink for include.js.  How can this part be better?
cd ..
rm include.js
ln -s production/include.js
