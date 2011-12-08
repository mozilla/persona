#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "$0" )" && pwd )"
VAR=$SCRIPT_DIR/../var
export PATH=$PATH:$SCRIPT_DIR/../node_modules/.bin

# if keys already exist, do nothing
if [ -f $VAR/root.cert ] ; then
    exit 0
fi

GENERATE_KEYPAIR=`which generate-keypair 2> /dev/null`
CERTIFY=`which certify 2> /dev/null`

if [ ! -x "$GENERATE_KEYPAIR" ] ; then
    echo "can't find generate-keypair from the jwcrypto package.  try: npm install"
    exit 1
fi

if [ ! -x "$CERTIFY" ] ; then
    echo "can't find certify from the jwcrypto package.  try: rm -rf node_modules && npm install"
    exit 1
fi

echo '*** Generating ephemeral keys used for testing ***'
$GENERATE_KEYPAIR -k 256 -a rsa
mkdir -p $VAR

# public key will be stored as a self signed certificate with an embedded
# creation date (so that if the key is updated, we can revoke outstanding
# certificates - GH-599 & GH-600)
$CERTIFY -s key.secretkey -p key.publickey > $VAR/root.cert
rm key.publickey
mv key.secretkey $VAR/root.secretkey
