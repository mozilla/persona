#!/bin/sh

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
cat lib/jquery-1.6.2.min.js lib/jschannel.js lib/underscore-min.js lib/vepbundle.js lib/ejs.js shared/browserid.js lib/hub.js lib/dom-jquery.js lib/module.js shared/javascript-extensions.js shared/mediator.js shared/class.js shared/storage.js $BUILD_PATH/templates.js shared/renderer.js shared/error-display.js shared/screens.js shared/tooltip.js shared/validation.js shared/network.js shared/user.js shared/error-messages.js shared/browser-support.js shared/wait-messages.js shared/helpers.js dialog/resources/internal_api.js dialog/resources/channel.js dialog/resources/helpers.js dialog/resources/state_machine.js dialog/controllers/page.js dialog/controllers/code_check.js dialog/controllers/actions.js dialog/controllers/dialog.js dialog/controllers/authenticate.js dialog/controllers/forgotpassword.js dialog/controllers/checkregistration.js dialog/controllers/pickemail.js dialog/controllers/addemail.js dialog/controllers/required_email.js dialog/start.js > $BUILD_PATH/dialog.uncompressed.js

# produce the dialog css
cat css/common.css dialog/css/popup.css dialog/css/m.css > $BUILD_PATH/dialog.uncompressed.css

# produce the non interactive frame js
cat lib/jquery-1.6.2.min.js lib/jschannel.js lib/underscore-min.js lib/vepbundle.js shared/javascript-extensions.js shared/browserid.js shared/storage.js shared/network.js shared/user.js communication_iframe/start.js > $BUILD_PATH/communication_iframe.uncompressed.js

# produce the relay js
cat lib/jschannel.js shared/browserid.js relay/relay.js relay/start.js > $BUILD_PATH/relay.uncompressed.js

echo ''
echo '****Building BrowserID.org HTML, CSS, and JS****'
echo ''

#produce the main site js
cat lib/jquery-1.6.2.min.js lib/json2.js lib/underscore-min.js lib/ejs.js shared/javascript-extensions.js shared/browserid.js lib/dom-jquery.js $BUILD_PATH/templates.js shared/renderer.js shared/error-display.js shared/screens.js shared/error-messages.js shared/storage.js shared/network.js shared/user.js shared/tooltip.js shared/validation.js shared/helpers.js pages/page_helpers.js pages/browserid.js pages/index.js pages/add_email_address.js pages/verify_email_address.js pages/forgot.js pages/manage_account.js pages/signin.js pages/signup.js > $BUILD_PATH/browserid.uncompressed.js

# produce the main site css
cat css/common.css css/style.css css/m.css > $BUILD_PATH/browserid.uncompressed.css

echo ''
echo '****Compressing all JS, CSS****'
echo ''

cd $PRODUCTION_PATH
# minify the JS
$UGLIFY < $BUILD_PATH/include.uncompressed.js > include.js
$UGLIFY < $BUILD_PATH/dialog.uncompressed.js > dialog.js
$UGLIFY < $BUILD_PATH/communication_iframe.uncompressed.js > communication_iframe.js
$UGLIFY < $BUILD_PATH/relay.uncompressed.js > relay.js
$UGLIFY < $BUILD_PATH/browserid.uncompressed.js > browserid.js

# minify the CSS
$UGLIFYCSS $BUILD_PATH/browserid.uncompressed.css > browserid.css
$UGLIFYCSS $BUILD_PATH/dialog.uncompressed.css > dialog.css

# set up new simlink for include.js.  How can this part be better?
cd ..
rm include.js
ln -s $PRODUCTION_PATH/include.js
