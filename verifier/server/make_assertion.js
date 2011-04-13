#!/usr/local/bin/node

const fs = require("fs");
const jwt = require("./jwt.js");
const idassertion = require("./idassertion.js");

function futureDate()
{
  var d = new Date();
  var future = new Date(d.getTime() + 1000 * 60 * 5);
  return future;
}

function makeAssertion(email, validUntil, audience, privateKeyData)
{
  var payload = {};
  payload["email"] = email;
  payload["valid-until"] = validUntil;
  payload["audience"] = audience;
  
  var token = new jwt.WebToken(JSON.stringify(payload), JSON.stringify({alg:"RS256"}));
  var signed = token.serialize(privateKeyData);
  return signed;
}

if (process.argv.length < 5) {
  console.log("Usage: node make_assertion.js <identity-address> <private-key-filename> <audience-hostname>");
  process.exit();
}

var address = process.argv[2];
var privateKey = process.argv[3];
var audience = process.argv[4];
var privateKeyData;

// Read the private key:
privateKeyData = fs.readFileSync(privateKey);
var a = makeAssertion(address, futureDate(), audience, privateKeyData.toString());
console.log(a);
