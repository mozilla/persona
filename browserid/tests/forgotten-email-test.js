#!/usr/bin/env node

const assert = require('assert'),
      vows = require('vows'),
      fs = require('fs'),
      path = require('path');

const amMain = (process.argv[1] === __filename);
const varPath = path.join(path.dirname(__dirname), "var");

function removeServerData() {
    fs.readdirSync(varPath).forEach(function(f) {
        fs.unlinkSync(path.join(varPath, f));
    });
}

// 10. remove the user database
removeServerData()

// 20. run the server
require("../run.js").runServer();

// create a new account via the api with (first address)

// manually verify the account

// add a new email address to the account (second address)

// run the "forgot_email" flow with first address

// try to log into the first email address with oldpassword

// try to log into the second email address with oldpassword

// try to log into the first email with newpassword


// stop the server
require("../run.js").stopServer();

// clean up
removeServerData();
