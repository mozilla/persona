%define _rootdir /opt/browserid

Name:          browserid-server
Version:       0.2014.07.19
Release:       2%{?dist}_%{svnrev}
Summary:       BrowserID server
Packager:      Daniel Thornton <relud@mozilla.com>
Group:         Development/Libraries
License:       MPL 2.0
URL:           https://github.com/mozilla/persona
Source0:       %{name}.tar.gz
BuildRoot:     %{_tmppath}/%{name}-%{version}-%{release}-root
AutoReqProv:   no
Requires:      nodejs-svcops >= 0.10.26, gmp
BuildRequires: gcc-c++, git, subversion, make, gmp, gmp-devel, nodejs-svcops >= 0.10.26

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
