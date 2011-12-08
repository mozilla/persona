const
certassertion = require('./certassertion.js');

process.on('message', function(m) {
  try {
    certassertion.verify(
      m.assertion, m.audience,
      function(email, audienceFromAssertion, expires, issuer) {
        process.send({
          success: {
            email: email,
            audience: audienceFromAssertion,
            expires: expires,
            issuer: issuer
          }
        });
      },
      function(error) {
        process.send({error: error});
      });
  } catch(e) {
    process.send({error: e.toString()});
  }
});
