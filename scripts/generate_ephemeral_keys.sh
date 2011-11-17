#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "$0" )" && pwd )"
VAR=$SCRIPT_DIR/../var
export PATH=$PATH:$SCRIPT_DIR/../node_modules/.bin

# if keys already exist, do nothing
if [ -f $VAR/root.publickey ] ; then
    exit 0
fi

GENERATE_KEYPAIR=`which generate-keypair 2> /dev/null`

if [ ! -x "$GENERATE_KEYPAIR" ] ; then
    echo "can't find generate-keypair from the jwcrypto package.  try: npm install"
    exit 1
fi

echo '*** Generating ephemeral keys used for testing ***'
$GENERATE_KEYPAIR -k 128 -a rsa
mkdir -p $VAR
mv key.publickey $VAR/root.publickey
mv key.secretkey $VAR/root.secretkey
