#!/bin/bash

cd ../resources/static
git checkout -- include.js shared/templates.js

if [ -e communication_iframe/production.js ] ; then
  rm communication_iframe/production.*
fi

if [ -e dialog/production.js ] ; then
  rm dialog/production.*
fi

