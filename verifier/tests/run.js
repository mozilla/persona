#!/usr/local/bin/node

/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla BrowserID.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

const jwt = require("../lib/jwt.js");
const idassertion = require("../lib/idassertion.js");
const vows = require('vows');
const assert = require('assert');

var PRIVATE_KEY = new Buffer("LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlFb3dJQkFBS0NBUUVBeEV5bWpsbVBNVXN2RTVQVStBVFNOd2c0dkxtS2tEMzFTRzI4WkRuN0RoNmMxT0FoCllYL3lFcCs1QlhxOHliQmtScGZDLzdzclJRNCtUeG5uR3NwUHQvZVF5S2ZORjgwbHd5NFRSQS9TYlJDallmK04KVHE2ZTh2M1FIOE05U2NpS01HME9MbXZNbk9nVi9tVFJVd1pTdUxPZXRaTEQxNmdDZ2QxR0cwc01BS0JYYkpaZwoyb3oxdEp1bFBPdGFDWW1ReHU1M2NWSGtmRHZGLzRLMG1LMTIyam8xRnh4UGtBbjNOcU1Db2QzR3hpOFVIaE5iCjBzOHhsVzl6Ynlvc2RmdGJqOWI1VGRCTXBSUzlmRWllc1psQVpxOGtPa1lUUnJVVHJZdjI1d2pYaEhCSGNOeUsKVEhDbjVYZGl2dTdzZFBMZVBEajhuSFJuTGo0cmtTaktwaUZHYXdJREFRQUJBb0lCQVFDZDVib2p6czVyckRwVgoyUmY1MklidlZXR3VET0QwWGFJcmZIbUpkVW9JZFg5WmpGL05lWWxTaWIvZU5IZ2ZGQS9VNk1ZbHhueHJzNlZUCkkxYk9LZVl0NktsQmZoaHZDTWxUVW9DVXd0VlVmWW11amswditTNUo3dmUyVk9tN3E5L2NUQnlZSW9ZWHdHZlEKbFcvN0JKOE5pdzRpcDhkNGRPQnZiWG16QW83SkFNZERBTXdDZlNPTFBwRVprMXdsc1Q5YjBHaHZnMHZsVU5oTwpISGRmSjYzRlRyY2xZUFZETXNuNmU1aEZOSXRCenVQeDlvUjN2eENmQjQyZkY5TVpYRnpIamx0NUd1Q0hqOUN0CkJ4UlJxdENsb1JLR3V1ak9DUkEzM1NaS3p3Snd2KzkzZkxZVkh0anBYOGsvczhjYkpFcFVzdDlxdGxZTmoxSFoKMmc2Q0t0QkJBb0dCQVBEQ0o4R20wYjQ2Y0FiLzY3MXMxeFJJYnRDbjZxSEtwVHFwN1RJT2FxajlOQWJqeDFrYgozTUJ1MUc4OVZzMFRvOWlZejB2M1VZcUMyZ0kzTnd2SEtZZTBReENaVE84Y2kvaVRxa3ZsbXZNbG1XK2ZwQnlRCmhzay8vTXMzQlcvM0VNRVhiUklLNXA3akFMa2ZyemVqY0pIeG5scTkzdlJob2lSZUsrMWVqTEVqQW9HQkFOQzUKK01HNU5wZnJjaUR0akhQelp5YlRUd0t2b0wzVEpvMWNESHJaaE5nWWNUOTgrSkM1bzcwWTIvSXprcHZPUmFuagpiUEIrcEhFM2ZYZ0dHVHFESGNtbyt2RnQ4MkZvRGVMdmRRb0NJblduMzJtTUlvQUthdE8zM3oreUFmcjg2eUZOCjIzdlNQL0JndXBrVEYvZ0ltY3QvK2tlWU12WDB6KzhsUVR6eUpMNFpBb0dBVldhWmthQ3AvODljMDY3T0lXaE4KTnIybXlVNzI5S01jVHgzZHJJYmVvTWtJUG5WbnpoMExCaHVLTVZkUnhmYjBoSzFYd3Z1Y3FnUldicmpGUnVGRAp3d1pYVDdrQlNFUVpCbmppekg5S29uc3czUjZFcVRrL0JuNHpIcWFLd0Rla2NzbnJmNTNzUm1vQlpLbHZqczNqCjdYRUdtZXVGL2F2d1J2UThvcnVLTG44Q2dZQTM0b01yQXpjTngvbGZ2WnFNZFJBYVFodDJnYVdORFpyVjRGNXIKQ2hCYWQzamk0Y2YvbitTcVBaeXVKWWJNZHBjS1hKMFBheWtHTXpCQjBZZ3h0V2RsVmZ3U1pqanl6SlJqUFcvZAp4U0tLMCs2cWFOM1g0SElueTZSWGZvYXZOOGFRdlRMVjNUNUhVdTdEQzJ5d2VVVU1TbkN0ZUorMFlON0hqZmNBCnBXaVhDUUtCZ0N5SDVETTFWb1NNaCtVSXJ6WW5vVVVKY1ZDL3EyWGp0Zkdod3JhVUJhTTZ6OVNXaFg2amZMSGkKNW9qc2ZjSE5vU3h5a0hJQllXNmovQ1ZVSmpoY2NRa0pnR2tHRmoxZkh2cTVpWGZPaTFjMWl6djQxQ0REWGRQKwpKcTNNbHMzaDVXTnJ5RTdhTTQ5S3JaRWpjbytzajVRc3dMMnkwTk1weHdHRE9palpqS0lyCi0tLS0tRU5EIFJTQSBQUklWQVRFIEtFWS0tLS0tCg==", "base64").toString();
var PUBLIC_KEY_PEM = new Buffer("LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUF4RXltamxtUE1Vc3ZFNVBVK0FUUwpOd2c0dkxtS2tEMzFTRzI4WkRuN0RoNmMxT0FoWVgveUVwKzVCWHE4eWJCa1JwZkMvN3NyUlE0K1R4bm5Hc3BQCnQvZVF5S2ZORjgwbHd5NFRSQS9TYlJDallmK05UcTZlOHYzUUg4TTlTY2lLTUcwT0xtdk1uT2dWL21UUlV3WlMKdUxPZXRaTEQxNmdDZ2QxR0cwc01BS0JYYkpaZzJvejF0SnVsUE90YUNZbVF4dTUzY1ZIa2ZEdkYvNEswbUsxMgoyam8xRnh4UGtBbjNOcU1Db2QzR3hpOFVIaE5iMHM4eGxXOXpieW9zZGZ0Ymo5YjVUZEJNcFJTOWZFaWVzWmxBClpxOGtPa1lUUnJVVHJZdjI1d2pYaEhCSGNOeUtUSENuNVhkaXZ1N3NkUExlUERqOG5IUm5MajRya1NqS3BpRkcKYXdJREFRQUIKLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0tCg==", "base64").toString();
var PUBLIC_KEY_MODULUS = "C44CA68E598F314B2F1393D4F804D2370838BCB98A903DF5486DBC6439FB0E1E9CD4E021617FF2129FB9057ABCC9B0644697C2FFBB2B450E3E4F19E71ACA4FB7F790C8A7CD17CD25C32E13440FD26D10A361FF8D4EAE9EF2FDD01FC33D49C88A306D0E2E6BCC9CE815FE64D1530652B8B39EB592C3D7A80281DD461B4B0C00A0576C9660DA8CF5B49BA53CEB5A098990C6EE777151E47C3BC5FF82B498AD76DA3A35171C4F9009F736A302A1DDC6C62F141E135BD2CF31956F736F2A2C75FB5B8FD6F94DD04CA514BD7C489EB1994066AF243A461346B513AD8BF6E708D784704770DC8A4C70A7E57762BEEEEC74F2DE3C38FC9C74672E3E2B9128CAA621466B";
var PUBLIC_KEY_EXPONENT = "10001";

function futureDate()
{
  var d = new Date();
  var future = new Date(d.getTime() + 1000 * 60 * 5);
  return future;
}
function pastDate()
{
  var d = new Date();
  var past = new Date(d.getTime() - 1000 * 60 * 5);
  return past;
}
function makeAssertion(email, validUntil, audience)
{
  var payload = {};
  payload["email"] = email;
  payload["valid-until"] = validUntil;
  payload["audience"] = audience;
  
  var token = new jwt.WebToken(JSON.stringify(payload), JSON.stringify({alg:"RS256"}));
  var signed = token.serialize(PRIVATE_KEY);
  return signed;
}

vows.describe('Assertion creation').addBatch({

    'Assertion creation': {
      'succeeds with all arguments': function() {
        var a = makeAssertion("joe@127.0.0.1:56080", futureDate(), "target.com");
        console.log(a);
      }
    }
}).run();


vows.describe('Assertion validation').addBatch({
    'Assertion validation with a valid assertion': {
        topic: 
          function() {
            var that = this;
            new idassertion.IDAssertion(
              makeAssertion("joe@127.0.0.1:56080", futureDate(), "target.com")
            ).verify(
              "target.com",
              this.callback,
              this.callback
            )
          },

        'was a success': function (result) {
          // no way in vows to detect which callback fired - wrapping this.callback seems to break it.
          // asserting true works, since result will be a message if the error callback happens.
          assert.equal(result, true); 
        }
    }
}).run(); // Run it

  
