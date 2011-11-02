%define _rootdir /opt/browserid

Name:          browserid-server
Version:       0.2011.10.13
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
npm install
export PATH=$PWD/node_modules/.bin:$PATH
(cd browserid && ./compress.sh)
git log -1 --oneline > browserid/static/ver.txt

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}%{_rootdir}
for f in browserid libs node_modules verifier *.json *.js; do
    cp -rp $f %{buildroot}%{_rootdir}/$dir
done

%clean
rm -rf %{buildroot}

%files
%defattr(-,root,root,-)
%{_rootdir}

%changelog
* Tue Oct 18 2011 Pete Fritchman <petef@mozilla.com>
- Initial version
