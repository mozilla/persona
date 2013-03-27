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
