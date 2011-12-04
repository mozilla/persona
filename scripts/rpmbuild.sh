#!/bin/bash

set -e

progname=$(basename $0)

cd $(dirname $0)/..    # top level of the checkout

mkdir -p rpmbuild/SOURCES rpmbuild/SPECS rpmbuild/SOURCES
rm -rf rpmbuild/RPMS rpmbuild/SOURCES/browserid

tar --exclude rpmbuild --exclude .git \
    --exclude var -czf \
    $PWD/rpmbuild/SOURCES/browserid-server.tar.gz .

set +e

export GIT_REVISION=$(git log -1 --oneline)

rpmbuild --define "_topdir $PWD/rpmbuild" -ba scripts/browserid.spec
rc=$?
if [ $rc -eq 0 ]; then
    ls -l $PWD/rpmbuild/RPMS/*/*.rpm
else
    echo "$progname: failed to build browserid RPM (rpmbuild rc=$rc)" >&2
fi

exit $rc
