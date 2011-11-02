#!/bin/bash

set -e

progname=$(basename $0)

cd $(dirname $0)/..    # top level of the checkout

curdir=$(basename $PWD)
if [ "$curdir" != "browserid" ]; then
    echo "$progname: git checkout must be in a dir named 'browserid'" >&2
    exit 1
fi

mkdir -p rpmbuild/SOURCES rpmbuild/SPECS
rm -rf rpmbuild/RPMS

tar -C .. --exclude rpmbuild -czf \
    $PWD/rpmbuild/SOURCES/browserid-server.tar.gz browserid

set +e

rpmbuild --define "_topdir $PWD/rpmbuild" -ba scripts/browserid.spec
rc=$?
if [ $rc -eq 0 ]; then
    ls -l $PWD/rpmbuild/RPMS/*/*.rpm
else
    echo "$progname: failed to build browserid RPM (rpmbuild rc=$rc)" >&2
fi

exit $rc
