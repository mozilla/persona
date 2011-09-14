#!/bin/bash

npm install

echo '*** Asking for sudo to install browserify globally ***'
sudo npm install -g browserify

cd lib/jwcrypto
./bundle.sh

echo ''
echo '*** Generating keys and placing them into correct location ***'
node generate-keypair.js

mv key.publickey ../../var/root.publickey
mv key.secretkey ../../var/root.privatekey
cd ../..

