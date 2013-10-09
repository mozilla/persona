Installing Dependencies on Windows 7
------------------------------------

The following packages are required to ensure `npm install` succeeds, installed in the order listed (make sure that all visual studio c++ redistributable components that might be listed in your "programs and features" list are uninstalled, first. This is inconvenient, but essential to get a working VC++ compiler stack set up).

* node 0.10.20 or higher (fixes several npm bugs that might prevent install)
* Microsoft Visual Studio C++ 2010 Express, http://go.microsoft.com/?linkid=9709949
* For Windows 7 x64, the Windows 7 64-bit SDK, http://www.microsoft.com/en-us/download/details.aspx?id=8279
* Microsoft Visual Studio C++ 2008 redistributable, http://slproweb.com/products/Win32OpenSSL.html
* Win32/Win64 OpenSSL, http://slproweb.com/products/Win32OpenSSL.html

After installing OpenSSL, add its `/bin` folder to your system's PATH variable.
