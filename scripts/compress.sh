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
cat ../lib/jschannel.js ../resources/browserid.js relay.js > production.js
$UGLIFY < production.js > production.min.js
mv production.min.js production.js


echo ''
echo '****Building BrowserID.org HTML, CSS, and JS****'
echo ''

cd ../pages
# re-minimize everything together
cat ../lib/jquery-1.6.2.min.js ../lib/json2.js ../resources/browserid.js ../resources/error-display.js ../resources/error-messages.js page_helpers.js browserid.js ../lib/underscore-min.js ../resources/browserid-extensions.js ../resources/storage.js ../resources/network.js ../resources/user.js ../resources/tooltip.js ../resources/validation.js index.js add_email_address.js verify_email_address.js manage_account.js signin.js signup.js forgot.js > lib.js
$UGLIFY < lib.js > lib.min.js

cd ../css
cat style.css m.css > browserid.css
$JAVA -jar $YUI_LOCATION browserid.css -o browserid.min.css
