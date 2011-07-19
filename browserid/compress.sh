#!/bin/sh

echo ''
echo '****Building dialog HTML, CSS, and JS****'
echo ''

cd static
steal/js dialog/scripts/build.js

echo ''
echo '****Building BrowserID.org HTML, CSS, and JS****'
echo ''

cd js
uglifyjs browserid.js > browserid.min.js
cat jquery-1.6.2.min.js ../dialog/resources/underscore-min.js browserid.min.js > lib.min.js

cd ../css
cat github.css style.css > browserid.min.css



