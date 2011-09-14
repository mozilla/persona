#!/bin/bash

npm install

echo '*** Asking for sudo to install browserify globally ***'
sudo npm install -g browserify

echo '*** Fetching and updating required submodules ***'
git submodule init
git submodule update

cd lib/jwcrypto
./bundle.sh

echo ''
echo '*** Generating keys and placing them into correct location ***'
node generate-keypair.js

mv key.publickey ../../var/root.publickey
mv key.secretkey ../../var/root.secretkey
cd ../..

