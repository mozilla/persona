#!/bin/sh

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

YUI_LOCATION=`pwd`'/static/steal/build/scripts/yui.jar'

echo ''
echo '****Compressing include.js****'
echo ''

cd static
mv include.js include.orig.js
$UGLIFY include.orig.js > include.js

echo ''
echo '****Building dialog HTML, CSS, and JS****'
echo ''

steal/js dialog/scripts/build.js

cd dialog
$UGLIFY < production.js > production.min.js
mv production.min.js production.js

cd css
cat popup.css m.css > production.css
$JAVA -jar $YUI_LOCATION production.css -o production.min.css

cd ../../relay
cat ../dialog/resources/jschannel.js relay.js > production.js
$UGLIFY < production.js > production.min.js
mv production.min.js production.js


echo ''
echo '****Building BrowserID.org HTML, CSS, and JS****'
echo ''

cd ../js
# re-minimize everything together
cat jquery-1.6.2.min.js json2.js browserid.js ../dialog/resources/underscore-min.js ../dialog/resources/browserid-extensions.js ../dialog/resources/storage.js ../dialog/resources/network.js ../dialog/resources/user.js ../dialog/resources/tooltip.js ../dialog/resources/validation.js pages/index.js pages/add_email_address.js pages/verify_email_address.js pages/manage_account.js pages/signin.js pages/signup.js pages/forgot.js > lib.js
$UGLIFY < lib.js > lib.min.js

cd ../css
cat style.css m.css > browserid.css
$JAVA -jar $YUI_LOCATION browserid.css -o browserid.min.css
