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

YUI_LOCATION='../../static/steal/build/scripts/yui.jar'

echo ''
echo '****Compressing include.js****'
echo ''

cd static
mv include.js include.orig.js
$UGLIFY -nc include.orig.js > include.js

echo ''
echo '****Building dialog HTML, CSS, and JS****'
echo ''

steal/js dialog/scripts/build.js

cd dialog
$UGLIFY < production.js > production.min.js
mv production.min.js production.js

cd ..
steal/js relay/scripts/build.js
cd relay
$UGLIFY < production.js > production.min.js
mv production.min.js production.js


echo ''
echo '****Building BrowserID.org HTML, CSS, and JS****'
echo ''

cd ../js
# re-minimize everything together
cat jquery-1.6.2.min.js json2.js ../dialog/resources/underscore-min.js ../dialog/resources/browserid-network.js ../dialog/resources/browserid-identities.js ../dialog/resources/storage.js browserid.js > lib.js
$UGLIFY < lib.js > lib.min.js

cd ../css
cat github.css style.css > browserid.css
$JAVA -jar $YUI_LOCATION browserid.css -o browserid.min.css
