// platforms supported by sauce that we test
const platforms = {
  /*
  "linux_firefox_16": {
    platform: 'LINUX',
    browserName: 'firefox',
    version: '16'
  },
  "linux_opera_12": {
    platform: 'LINUX',
    browserName: 'opera',
    version: '12'
  },
  "osx_firefox_14": {
    platform: 'MAC',
    browserName:'firefox',
    version:'14'
  },*/
  "vista_chrome": {
    platform:'VISTA',
    browserName:'chrome'
  },
  "vista_firefox_16": {
    platform:'VISTA',
    browserName:'firefox',
    version:'16'
  },
  "vista_ie_9": {
    platform:'VISTA',
    browserName:'internet explorer',
    version:'9'
  },/*
  "win8_ie_10": {
    platform: 'Windows 2012',
    browserName: 'internet explorer',
    version: '10'
  },*/
  "xp_ie_8": {
    platform:'XP',
    browserName: 'internet explorer',
    version:'8'
  }/*,
  "osx_safari_5": {
    platform:'Mac 10.6',
    browserName: 'safari',
    version:'5'
  }*/
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
  'selenium-version': '2.26.0'
};

exports.platforms = platforms;
exports.defaultCapabilities = defaultCapabilities;
exports.defaultPlatform = "vista_firefox_16";
