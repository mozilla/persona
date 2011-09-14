#!/bin/bash

echo ''
echo '*** Generating keys and placing them into correct location ***'
cd lib/jwcrypto
node generate-keypair.js

mv key.publickey ../../var/root.publickey
mv key.secretkey ../../var/root.secretkey
cd ../..
