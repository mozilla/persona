//
// Platforms supported by sauce that we test. See
// https://saucelabs.com/docs/browsers for available versions and OS.
//
const platforms = {
  // Firefox
  "win7_firefox_22": {
    platform: 'Windows 7',
    browserName: 'firefox',
    version: '22'
  },
  "linux_firefox_22": {
    platform: 'Linux',
    browserName: 'firefox',
    version: '22'
  },
  "osx_firefox_21": {
    platform: 'Mac 10.6',
    browserName:'firefox',
    version:'21'
  },

  // Chrome
  "win7_chrome": {
    platform:'Windows 2008',
    browserName:'chrome'
  },

  // IE
  "winxp_ie_8": {
    platform:'Windows 2003',
    browserName: 'internet explorer',
    version:'8'
  },
  "win7_ie_9": {
    platform:'Windows 2008',
    browserName:'internet explorer',
    version:'9'
  },
  "win8_ie_10": {
    platform: 'Windows 2012',
    browserName: 'internet explorer',
    version: '10'
  },

  // Opera
  "linux_opera_12": {
    platform: 'Linux',
    browserName: 'opera',
    version: '12'
  },

  // Safari
  "osx_safari_6": {
    platform:'Mac 10.8',
    browserName: 'safari',
    version:'6'
  }
};

// see http://saucelabs.com/docs/ondemand/additional-config for other opts
const defaultCapabilities = {
  // the proxy leads to bugginess/sadness, avoid unless opera/IE
  avoidProxy: true,
  // make tests public by default. set public:false in desiredCapabilities to override this.
  public: true,
  // timeout if no command received. if you juggle 2 browser sessions,
  // one will possibly hit this, so don't be too conservative.
  'idle-timeout': 90,
  // timeout global time used by a test. should avoid runaway tests eating
  // 10 min of sauce time. setting to 3 min for now, relax if needed.
  'max-session': 180,
  // use newest available selenium-server version
  // necessary for IE9 to work, but a good idea generally
  'selenium-version': '2.32.0'
};

exports.platforms = platforms;
exports.defaultCapabilities = defaultCapabilities;
exports.defaultPlatform = "win7_firefox_22";
