#!/bin/sh

if [ ! -f $HOME/var/root.cert ] ; then
    echo ">> generating keypair"
    node scripts/postinstall.js
    mv var/root.cert var/root.secretkey $HOME/var
else
    echo ">> no keypair needed.  you gots one"
fi

echo ">> generating production resources"
scripts/compress
