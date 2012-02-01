#!/bin/sh
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# compress.sh creates all artifacts from browserid.rpm


cd $(dirname "$0")/..

export PATH=$PWD/node_modules/.bin:$PATH


UGLIFY=`which uglifyjs 2> /dev/null`
if [ ! -x "$UGLIFY" ]; then
    echo "uglifyjs not found in your path.  Have you npm installed lately?"
    exit 1
fi

UGLIFYCSS=`which uglifycss 2> /dev/null`
if [ ! -x "$UGLIFYCSS" ]; then
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
`BUILD_DIR=$BUILD_PATH ../../../../scripts/create_templates.js`
cd ../..

# produce the dialog css
cat css/common.css dialog/css/popup.css dialog/css/m.css > $BUILD_PATH/dialog.uncompressed.css

# produce the non interactive frame js
cat lib/jquery-1.7.1.min.js lib/jschannel.js lib/winchan.js lib/underscore-min.js lib/vepbundle.js lib/hub.js shared/javascript-extensions.js shared/browserid.js shared/mediator.js shared/helpers.js shared/storage.js shared/xhr.js shared/network.js shared/user.js communication_iframe/start.js > $BUILD_PATH/communication_iframe.uncompressed.js

echo ''
echo '****Building BrowserID.org CSS****'
echo ''

# produce the main site css
cat css/common.css css/style.css css/m.css > $BUILD_PATH/browserid.uncompressed.css

echo ''
echo '****Compressing all JS, CSS****'
echo ''

cd $PRODUCTION_PATH

pwd
$UGLIFY < $BUILD_PATH/communication_iframe.uncompressed.js > communication_iframe.js


# minify the CSS
$UGLIFYCSS $BUILD_PATH/browserid.uncompressed.css > browserid.css
$UGLIFYCSS $BUILD_PATH/dialog.uncompressed.css > dialog.css
