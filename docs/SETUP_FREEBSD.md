Installing Dependencies on FreeBSD
---------------------------------

Run the following to install necessary dependencies:

    cd /usr/ports
    make -C www/node install clean
    make -C math/gmp install clean
    make -C www/npm install clean
    make -C devel/git install clean

or  with pkgng

    pkg add  www/node math/gmp www/npm devel/git
