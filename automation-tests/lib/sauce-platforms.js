// platforms supported by sauce that we test
const platforms = {
  "linux_firefox_13": {
    platform: 'LINUX',
    browserName: 'firefox',
    version: '13'
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
  "vista_firefox_13": {
    platform:'VISTA',
    browserName:'firefox',
    version:'13'
  },
  "vista_ie_9": {
    platform:'VISTA',
    browserName:'internet explorer',
    version:'9'
  },
  "xp_ie_8": {
    platform:'XP',
    browserName: 'internet explorer',
    version:'8'
  }
}

const defaultCapabilities = {
  avoidProxy: true,
};

exports.platforms = platforms;
exports.defaultCapabilities = defaultCapabilities;
