//
// By default, we assume local platforms just have default locations.
//
// You must have installed ChromeDriver to use Chrome.
// Ditto for all Webdrivers except Firefox.
// see the Webdriver wiki for more: https://code.google.com/p/selenium/w/list
//
const platforms = {
  "firefox": {
    platform: 'ANY',
    browserName: 'firefox',
    version: ''
  },
  /* if you wish to add a second firefox, give it a unique name and specify
     the path to the binary, which will vary across systems.
     --> This won't work for other browsers, only FF.
     --> The example shows a Mac path, but you could insert a Linux or Win path too.

  "firefox-nightly": {
    platform: 'ANY',
    browserName: 'firefox',
    version: '',
    firefox_binary: '/Applications/FirefoxNightly.app/Contents/MacOS/firefox-bin'
  },
  */
  "chrome": {
    platform: 'ANY',
    browserName: 'chrome',
    version: ''
  },
  "opera": {
    platform: 'ANY',
    browserName: 'opera',
    version: ''
  },
  "safari": {
    platform: 'ANY',
    browserName: 'safari',
    version: ''
  },
  "ie": {
    platform: 'ANY',
    browserName: 'internet explorer',
    version: ''
  }
};

// see https://code.google.com/p/selenium/wiki/DesiredCapabilities for other opts
const defaultCapabilities = {
  javascriptEnabled: true
};

exports.platforms = platforms;
exports.defaultCapabilities = defaultCapabilities;
exports.defaultPlatform = "firefox";
