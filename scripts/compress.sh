#!/bin/sh

cd $(dirname "$0")/..

UGLIFY=`which uglifyjs 2> /dev/null`
if [ ! -x "$UGLIFY" ]; then
    echo "uglifyjs not found in your path.  can't create production resources.  disaster."
    exit 1
fi

JAVA=`which java 2> /dev/null`
if [ ! -x "$JAVA" ]; then
    echo "java not found in your path.  can't create production resources.  disaster."
    exit 1
fi

YUI_LOCATION=`pwd`'/resources/static/steal/build/scripts/yui.jar'

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

steal/js dialog/scripts/build.js


cd communication_iframe
$UGLIFY < production.js > production.min.js
mv production.min.js production.js

cd ../dialog
$UGLIFY < production.js > production.min.js
mv production.min.js production.js

cd css
cat popup.css m.css > production.css
$JAVA -jar $YUI_LOCATION production.css -o production.min.css

cd ../../relay
cat ../lib/jschannel.js ../shared/browserid.js relay.js > production.js
$UGLIFY < production.js > production.min.js
mv production.min.js production.js


echo ''
echo '****Building BrowserID.org HTML, CSS, and JS****'
echo ''

cd ../pages
# re-minimize everything together
cat ../lib/jquery-1.6.2.min.js ../lib/json2.js ../lib/underscore-min.js ../lib/ejs.js ../shared/browserid-extensions.js ../shared/browserid.js ../lib/dom-jquery.js ../shared/templates.js ../shared/renderer.js ../shared/error-display.js ../shared/screens.js ../shared/error-messages.js ../shared/storage.js ../shared/network.js ../shared/user.js ../shared/tooltip.js ../shared/validation.js ../shared/helpers.js page_helpers.js browserid.js index.js add_email_address.js verify_email_address.js forgot.js manage_account.js signin.js signup.js > lib.js
$UGLIFY < lib.js > lib.min.js

cd ../css
cat style.css m.css > browserid.css
$JAVA -jar $YUI_LOCATION browserid.css -o browserid.min.css
