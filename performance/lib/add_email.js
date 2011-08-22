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

/* this file is the "add_email" activity, which simulates the process of a
 * user with an active session adding a new email with browserid. */

exports.startFunc = function(cfg, cb) {
  // 1. RP includes include.js 
  // 2. users' browser loads all code associated with dialog
  // 3. /wsapi/add_email is called to stage the email address
  // 4. in the load testing environment, we make a call to the server to get
  //    the email verification token
  // 5. /prove is called on the server, passing in the authentication token
  // 6. /manage is called on the server as the user's page transitions from
  //    the verify screen to the manage screen.
  // 7. /wsapi/sync_emails is called from the client upon verification
  //    (this is a bug, isn't it?)
  // 8. /wsapi/set_key is called from the client to inform the server of the
  //    user's public key for this new email (XXX: this will go away when we migrate to certificates
  //    and instead, the server will be asked to sign the user's public key.)
  // 9. the RP calls /verify to verify a generated assertion

  // XXX: write me
  setTimeout(function() { cb(true); }, 10); 
};
