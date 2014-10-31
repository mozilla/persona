Installing Dependencies on FreeBSD
---------------------------------

Run the following to install necessary dependencies:

    cd /usr/ports
    make -C www/node install clean
    make -C math/gmp install clean
    make -C www/npm install clean
    make -C devel/git install clean
    make -C lang/gcc install clean

or with pkgng:

    pkg install www/node math/gmp www/npm devel/git lang/gcc

GCC will install g++ at /usr/local/bin/g++XX, where XX represents the version.
Somewhere in the system's PATH, add a symlink named "g++" pointing to the
installed version.

For example (assuming GCC 4.9)

    ln -s /usr/local/bin/g++49 /usr/local/bin/g++