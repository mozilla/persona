# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

clean:
	rm -rf node_modules rpmbuild

npm:
	npm install

rpm: npm
	scripts/rpmbuild.sh

test: npm
	npm test

jenkins_build: clean npm test rpm
