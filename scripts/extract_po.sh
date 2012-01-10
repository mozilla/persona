#!/bin/bash

# syntax:
# extract-po.sh


# messages.po is server side strings
xgettext  -j --keyword=_ -L Perl --output-dir=locale/templates/LC_MESSAGES --from-code=utf-8 --output=messages.pot\
 `find lib -name '*.js' | grep -v 'i18n.js'`
xgettext -j -L PHP --keyword=_ --output-dir=locale/templates/LC_MESSAGES --output=messages.pot `find resources/views -name '*.ejs'`
xgettext -j -L PHP --keyword=_ --output-dir=locale/templates/LC_MESSAGES --output=messages.pot `find lib/browserid -name '*.ejs'`

# client.po 
# js
xgettext -j -L Perl --output-dir=locale/templates/LC_MESSAGES --from-code=utf-8 --output=client.pot\
 `find resources/static -name '*.js' | grep -v /lib/ | grep -v /build/ | grep -v /production/ | grep -v 'gettext.js'`
xgettext -j -L Perl --output-dir=locale/templates/LC_MESSAGES --output=client.pot `find resources/static/dialog/ -name '*.js'`
# ejs
xgettext -j -L PHP --keyword=_ --output-dir=locale/templates/LC_MESSAGES --output=client.pot `find resources/static -name '*.ejs'`




