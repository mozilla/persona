clean:
	rm -rf node_modules rpmbuild

npm:
	npm install

rpm: npm
	scripts/rpmbuild.sh

test: npm
	npm test

jenkins_build: clean npm test rpm
