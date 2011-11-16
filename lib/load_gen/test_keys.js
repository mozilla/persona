var jwk = require('jwcrypto/jwk');

const NUM_KEYPAIRS = 10;

process.stdout.write("generating " + NUM_KEYPAIRS +
                     " keypairs to be (re)used in load generation: ");

exports.keyPairs = [];

while (exports.keyPairs.length < NUM_KEYPAIRS)
{
  exports.keyPairs.push(jwk.KeyPair.generate("DS", 256));
  process.stdout.write(".");
}

process.stdout.write("\n");
