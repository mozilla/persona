#!/bin/sh

cd $(dirname "$0")/..

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

echo ''
echo '****Compressing include.js****'
echo ''

cd resources/static
mv include.js include.orig.js
$UGLIFY include.orig.js > include.js

echo ''
echo '****Building dialog HTML, CSS, and JS****'
echo ''

## This creates a combined templates file which is copied into
## resources/templates.js and included into the minified bundle.

cd dialog/views
../../../../scripts/create_templates.js
cd ../../
cp shared/templates.js shared/templates.js.orig
cp dialog/views/templates.js shared/templates.js

# produce the dialog js
cat dialog/resources/channel.js lib/jquery-1.6.2.min.js lib/jschannel.js lib/underscore-min.js lib/vepbundle.js lib/ejs.js shared/browserid.js lib/openajax.js lib/dom-jquery.js lib/module.js shared/javascript-extensions.js shared/mediator.js shared/class.js shared/storage.js shared/templates.js shared/renderer.js shared/error-display.js shared/screens.js shared/tooltip.js shared/validation.js shared/network.js shared/user.js shared/error-messages.js shared/browser-support.js shared/wait-messages.js shared/helpers.js dialog/resources/helpers.js dialog/resources/state_machine.js dialog/controllers/page.js dialog/controllers/dialog.js dialog/controllers/authenticate.js dialog/controllers/forgotpassword.js dialog/controllers/checkregistration.js dialog/controllers/pickemail.js dialog/controllers/addemail.js dialog/controllers/required_email.js dialog/start.js > dialog/production.js

# produce the non interactive frame js
cat lib/jquery-1.6.2.min.js lib/jschannel.js lib/underscore-min.js lib/vepbundle.js shared/javascript-extensions.js shared/browserid.js shared/storage.js shared/network.js shared/user.js communication_iframe/start.js > communication_iframe/production.js

cd communication_iframe
$UGLIFY < production.js > production.min.js
cp production.js production.uncompressed.js
mv production.min.js production.js

cd ../dialog
$UGLIFY < production.js > production.min.js
cp production.js production.uncompressed.js
mv production.min.js production.js

cd css
cat popup.css m.css > production.css
$UGLIFYCSS production.css > production.min.css

cd ../../relay
cat ../lib/jschannel.js ../shared/browserid.js relay.js > production.js
$UGLIFY < production.js > production.min.js
mv production.min.js production.js


echo ''
echo '****Building BrowserID.org HTML, CSS, and JS****'
echo ''

cd ../pages
# re-minimize everything together
cat ../lib/jquery-1.6.2.min.js ../lib/json2.js ../lib/underscore-min.js ../lib/ejs.js ../shared/javascript-extensions.js ../shared/browserid.js ../lib/dom-jquery.js ../shared/templates.js ../shared/renderer.js ../shared/error-display.js ../shared/screens.js ../shared/error-messages.js ../shared/storage.js ../shared/network.js ../shared/user.js ../shared/tooltip.js ../shared/validation.js ../shared/helpers.js page_helpers.js browserid.js index.js add_email_address.js verify_email_address.js forgot.js manage_account.js signin.js signup.js > lib.js
$UGLIFY < lib.js > lib.min.js

cd ../css
cat style.css m.css > browserid.css
$UGLIFYCSS browserid.css > browserid.min.css
