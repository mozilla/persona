%define _rootdir /opt/browserid

Name:          browserid-server
Version:       0.2011.11.03
Release:       1%{?dist}
Summary:       BrowserID server
Packager:      Pete Fritchman <petef@mozilla.com>
Group:         Development/Libraries
License:       MPL 1.1+/GPL 2.0+/LGPL 2.1+
URL:           https://github.com/mozilla/browserid
Source0:       %{name}.tar.gz
BuildRoot:     %{_tmppath}/%{name}-%{version}-%{release}-root
AutoReqProv:   no
Requires:      openssl nodejs
BuildRequires: gcc-c++ git jre make npm openssl-devel

%description
browserid server & web home for browserid.org

%prep
%setup -q -n browserid

%build
rm -rf node_modules/jwcrypto
npm install
export PATH=$PWD/node_modules/.bin:$PATH
(scripts/compress.sh)
echo "$GIT_REVISION" > resources/static/ver.txt

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}%{_rootdir}
for f in bin lib node_modules resources scripts *.json; do
    cp -rp $f %{buildroot}%{_rootdir}/
done

%clean
rm -rf %{buildroot}

%files
%defattr(-,root,root,-)
%{_rootdir}

%changelog
* Tue Oct 18 2011 Pete Fritchman <petef@mozilla.com>
- Initial version
