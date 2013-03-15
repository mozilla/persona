// Depending on the environment variable PERSONA_ENV, we will change the
// URLS for various sites used during testing.  This lets you target
// different environments

const URLS = {
  dev: {
    "123done": 'http://dev.123done.org',
    persona: 'https://login.dev.anosrep.org',
    personatestuser: 'http://personatestuser.org/email/dev/',
    myfavoritebeer: 'http://dev.myfavoritebeer.org',
    eyedeeme: 'https://eyedee.me',
    kpiggybank: 'https://piggy-stage.personatest.org/wsapi/interaction_data'
  },
  stage: {
    "123done": 'http://beta.123done.org',
    persona: 'https://login.anosrep.org',
    personatestuser: 'http://personatestuser.org/email/stage/',
    myfavoritebeer: 'http://beta.myfavoritebeer.org',
    eyedeeme: 'https://eyedee.me',
    kpiggybank: 'https://piggy-stage.personatest.org/wsapi/interaction_data'
  },
  prod: {
    "123done": 'http://123done.org',
    persona: 'https://login.persona.org',
    personatestuser: 'http://personatestuser.org/email/prod/',
    myfavoritebeer: 'http://myfavoritebeer.org',
    eyedeeme: 'https://eyedee.me',
    kpiggybank: 'https://piggy-stage.personatest.org/wsapi/interaction_data'
  }
};

var env = process.env['PERSONA_ENV'] || 'dev';

if (!URLS[env]) {
  var personaURL = env + '.personatest.org';
  URLS[env] = {
    "123done": 'http://'+env+'.123done.org',
    persona: 'https://'+personaURL,
    personatestuser: 'http://personatestuser.org/email/custom/?browserid='+personaURL+'&verifier='+personaURL+'/verify',
    myfavoritebeer: 'http://'+env+'.myfavoritebeer.org',
    eyedeeme: 'https://eyedee.me',
    kpiggybank: 'https://piggy-stage.personatest.org/wsapi/interaction_data'
  };
}

module.exports = URLS[env];
