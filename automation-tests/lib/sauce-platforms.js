// platforms supported by sauce that we test
const platforms = {
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
  },
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
  },
  "win8_ie_10": {
    platform: 'Windows 2012',
    browserName: 'internet explorer',
    version: '10'
  },
  "xp_ie_8": {
    platform:'XP',
    browserName: 'internet explorer',
    version:'8'
  },
  "osx_safari_5": {
    platform:'Mac 10.6',
    browserName: 'safari',
    version:'5'
  }
};

const defaultCapabilities = {
  avoidProxy: true,
  public: true
};

exports.platforms = platforms;
exports.defaultCapabilities = defaultCapabilities;
