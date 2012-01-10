#!/bin/bash
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


cd ../resources/static
git checkout -- include.js shared/templates.js

if [ -e communication_iframe/production.js ] ; then
  rm communication_iframe/production.*
fi

if [ -e dialog/production.js ] ; then
  rm dialog/production.*
fi

