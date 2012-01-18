#!/bin/bash

# syntax:
# compile-mo.sh locale-dir/

function usage() {
    echo "syntax:"
    echo "compile.sh locale-dir/"
    exit 1
}

# check if file and dir are there
if [[ ($# -ne 1) || (! -d "$1") ]]; then usage; fi

for lang in `find $1 -type f -name "*.po"`; do
    dir=`dirname $lang`
    stem=`basename $lang .po`
    msgmerge -o ${dir}/${stem}.po.tmp ${dir}/${stem}.po $1/templates/LC_MESSAGES/${stem}.pot
    mv ${dir}/${stem}.po.tmp ${dir}/${stem}.po
done

# Optionally auto-localize our test locale db-LB
if hash podebug >/dev/null; then
    for catalog in messages client; do
                                                                                                         
        echo "Translating ${catalog}.po"
        podebug --rewrite=flipped -i locale/templates/LC_MESSAGES/${catalog}.pot\
               -o locale/eo/LC_MESSAGES/${catalog}.po
    done  
else
  echo 'Skipping db-LB, install translate-toolkit if you want to have that up-to-date.'
fi
