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

/*globals steal
 */
steal.plugins(
	'jquery/controller',			// a widget factory
	'jquery/controller/subscribe',	// subscribe to OpenAjax.hub
	'jquery/view/ejs',				// client side templates
	'jquery/controller/view')		// lookup views with the controller's name

	.css("style")	// loads styles

	.resources('jschannel',
               'underscore-min',
               'crypto',
               'crypto-api',
               'channel',
               'storage',
               'browserid-network',
               'browserid-errors',
               'browserid-wait')					// 3rd party script's (like jQueryUI), in resources folder

	.models()						// loads files in models folder 

	.controllers('page',
               'dialog',
               'authenticate',
               'createaccount',
               'checkregistration',
               'forgotpassword',
               'chooseemail',
               'addemail')					// loads files in controllers folder

	.views('authenticate.ejs',
           'addemail.ejs',
           'body.ejs',
           'bottom-addemail.ejs',
           'bottom-confirmemail.ejs',
           'bottom-continue.ejs',
           'bottom-pickemail.ejs',
           'bottom-signin.ejs',
           'bottom.ejs',
           'confirmemail.ejs',
           'create.ejs',
           'forgotpassword.ejs',
           'signin.ejs',
           'wait.ejs'
          );						// adds views to be added to build
