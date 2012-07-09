#!/bin/bash

if [ ! -f $HOME/var/root.cert ] ; then
    echo ">> generating keypair"
    scripts/generate_ephemeral_keys.sh
    mv var/root.{cert,secretkey} $HOME/var
else
    echo ">> no keypair needed.  you gots one"
fi

#echo ">> updating strings"
#svn co -q http://svn.mozilla.org/projects/l10n-misc/trunk/browserid/locale
#cd locale
#svn up
#cd ..
#./scripts/extract_po.sh locale/
## yuck!  our debug language breaks if this is not present
#for file in locale/templates/LC_MESSAGES/*.pot ; do
#    mv $file $file.old
#    sed 's/CHARSET/UTF-8/g' $file.old > $file
#    rm -f $file.old
#done
#
#./scripts/merge_po.sh locale/
#./locale/compile-mo.sh locale/
#./locale/compile-json.sh locale/ resources/static/i18n/

echo ">> generating production resources"
scripts/compress
