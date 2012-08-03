#!/bin/bash

if [ ! -d $HOME/code/locale ] ; then
    cd $HOME/code
    svn co https://svn.mozilla.org/projects/l10n-misc/trunk/browserid/locale
fi

cd $HOME/code/locale/

X=`svn status -u | wc -l`

if [ "x$X" != "x1" ] ; then
    echo "oh boy, new translations.  time to update translate.personatest.org"
    # trigger a redeployment
    cd $HOME/git
    ../post-update.js
    git log -2 --oneline master | tail -1 >> $HOME/ver.txt
    cd $HOME/code/locale
    svn info | egrep ^Revision: >> $HOME/ver.txt
fi
