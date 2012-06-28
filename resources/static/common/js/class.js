/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


BrowserID.Class = (function() {
  function create(constr, config) {
    var inst = new constr;
    inst.init(config);
    return inst;
  }

  function extend(sup, extension) {
    // No superclass
    if(!extension) {
      extension = sup;
      sup = null;
    }

    var subclass = extension.hasOwnProperty("constructor") ? extension.constructor : function() {};

    if(sup) {
      // there is a superclass, set it up.
      // Object.create would work well here.
      var F = function() {};
      F.prototype = sup.prototype;
      subclass.prototype = new F;
      subclass.sc = sup.prototype;
    }
    else {
      // no superclass, create a prototype object.
      subclass.prototype = {};
    }

    for(var key in extension) {
      subclass.prototype[key] = extension[key];
    }
    subclass.prototype.constructor = subclass;

    /**
     * Extend a class to create a subclass.
     * @method extend
     * @param {object} extensions - prototype extensions
     * @returns {function} subclass
     */
    subclass.extend = extend.bind(null, subclass);
    /**
     * Create an instance of a class
     * @method create
     * @param {object} [config] - configuration, passed on to init.
     */
    subclass.create = create.bind(null, subclass);

    return subclass;
  }

  return extend;

}());

