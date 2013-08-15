%define _rootdir /opt/browserid

Name:          browserid-server
Version:       0.2013.08.28
Release:       1%{?dist}_%{svnrev}
Summary:       BrowserID server
Packager:      Gene Wood <gene@mozilla.com>
Group:         Development/Libraries
License:       MPL 2.0
URL:           https://github.com/mozilla/browserid
Source0:       %{name}.tar.gz
BuildRoot:     %{_tmppath}/%{name}-%{version}-%{release}-root
AutoReqProv:   no
Requires:      openssl, nodejs >= 0.8.17
BuildRequires: gcc-c++, git, jre, make, npm, openssl-devel, expat-devel, nodejs >= 0.8.17

%description
persona server & web home for persona.org

%prep
%setup -q -c -n browserid

%build
npm install
export PATH=$PWD/node_modules/.bin:$PATH
mkdir -p resources/static/i18n/
./node_modules/.bin/compile-json locale/ resources/static/i18n/
echo "$GIT_REVISION" > resources/static/ver.txt
echo "locale svn r$SVN_REVISION" >> resources/static/ver.txt
env CONFIG_FILES=$PWD/config/l10n-all.json scripts/compress
cp resources/static/build/include.js %{_builddir}/browserid/resources/static/production/include.orig.js
rm -r resources/static/build resources/static/test

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}%{_rootdir}
for f in bin lib locale node_modules resources scripts *.json CONTRIBUTORS; do
    cp -rp $f %{buildroot}%{_rootdir}/
done
mkdir -p %{buildroot}%{_rootdir}/config
cp -p config/l10n-all.json %{buildroot}%{_rootdir}/config
cp -p config/l10n-prod.json %{buildroot}%{_rootdir}/config
# now let's link en to en-US
mkdir -p %{buildroot}%{_rootdir}/resources/static/i18n/
ln -s en-US %{buildroot}%{_rootdir}/resources/static/i18n/en

%clean
rm -rf %{buildroot}

%files
%defattr(-,root,root,-)
%{_rootdir}

%changelog
* Tue Oct 18 2011 Pete Fritchman <petef@mozilla.com>
- Initial version
