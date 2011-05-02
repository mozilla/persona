// this is the picker code!  it runs in the identity provider's domain, and
// fiddles the dom expressed by picker.html
(function() {
  var chan = Channel.build(
    {
      window: window.parent,
      origin: "*",
      scope: "mozid"
    });

    function persistAddressAndKeyPair(email, keypair, issuer)
    {
        var emails = {};
        if (window.localStorage.emails) {
            emails = JSON.parse(window.localStorage.emails);
        }

        emails[email] = {
            created: new Date(),
            pub: keypair.pub,
            priv: keypair.priv
        };
        if (issuer) {
            emails[email].issuer = issuer;
        }
        window.localStorage.emails = JSON.stringify(emails);
    }

    chan.bind("registerVerifiedEmail", function(trans, args) {
        // This is a primary registration - the persisted
        // identity does not have an issuer because it 
        // was directly asserted by the controlling domain.

        var keypair = CryptoStubs.genKeyPair();
        persistAddressAndKeyPair(args.email, keypair);
    });
})();
