#!/bin/bash

# syntax:
# check-po.sh

for lang in `find locale -type f -name "*.po"`; do
    dir=`dirname $lang`
    stem=`basename $lang .po`
    printf "${lang}: "
    msgfmt --statistics ${dir}/${stem}.po
done
rm messages.mo
