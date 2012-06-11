#!/bin/bash

if [ ! -f $HOME/var/root.cert ] ; then
    echo ">> generating keypair"
    scripts/generate_ephemeral_keys.sh
    mv var/root.{cert,secretkey} $HOME/var
else
    echo ">> no keypair needed.  you gots one"
fi

echo ">> updating strings"
svn co -q http://svn.mozilla.org/projects/l10n-misc/trunk/browserid/locale
./locale/compile-mo.sh locale/

echo ">> generating production resources"
scripts/compress
