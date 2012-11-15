// Depending on the environment variable PERSONA_ENV, we will change the
// URLS for various sites used during testing.  This lets you target
// different environments

const URLS = {
  dev: {
    "123done": 'http://dev.123done.org',
    persona: 'https://login.dev.anosrep.org',
    myfavoritebeer: 'http://dev.myfavoritebeer.org',
    eyedeeme: 'https://eyedee.me'
  },
  stage: {
    "123done": 'http://beta.123done.org',
    persona: 'https://login.anosrep.org',
    myfavoritebeer: 'http://beta.myfavoritebeer.org',
    eyedeeme: 'https://eyedee.me'
  },
  prod: {
    "123done": 'http://123done.org',
    persona: 'https://login.persona.org',
    myfavoritebeer: 'http://myfavoritebeer.org',
    eyedeeme: 'https://eyedee.me'
  }
};

var env = process.env['PERSONA_ENV'] || 'dev';

if (!URLS[env]) {
  URLS[env] = {
    "123done": 'http://'+env+'.123done.org',
    persona: 'https://'+env+'.personatest.org',
    myfavoritebeer: 'http://'+env+'.myfavoritebeer.org',
    eyedeeme: 'https://eyedee.me'
  };
}

module.exports = URLS[env];
