var jwk = require('jwcrypto/jwk');

const NUM_KEYPAIRS = 10;

process.stdout.write("generating " + NUM_KEYPAIRS +
                     " keypairs to be (re)used in load generation: ");

var keyPairs = [];

while (keyPairs.length < NUM_KEYPAIRS)
{
  keyPairs.push(jwk.KeyPair.generate("DS", 256));
  process.stdout.write(".");
}
process.stdout.write("\n");
