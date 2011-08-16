#!/usr/bin/env node

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
 *   Lloyd Hilaiel <lloyd@hilaiel.com> 
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

/* This file is the main run file for the browserid load generation
 * tool, which is capable of analysing the maximum active users that
 * a browserid deployment can support */


// option processing with optimist 
var argv = require('optimist')
.usage('Apply load to a BrowserID server.\nUsage: $0', [ "foo" ])
.alias('h', 'help')
.describe('h', 'display this usage message')
.alias('m', 'max')
.describe('m', 'maximum active users to simulate (0 == infinite)')
.default('m', 100)
.alias('s', 'server')
.describe('s', 'base URL to browserid server')
.demand('s')
.alias('v', 'verifier')
.describe('v', 'base URL to verifier service (default is browserid server + \'/verify\')');

var args = argv.argv;

if (args.h) {
  argv.showHelp();
  process.exit(1);
}

