/**
* Written by Shane Tomlinson - original source at:
* https://github.com/stomlinson/AFrame-JS/blob/master/src/adapters/jquery.js
* which is licensed under the Creative Commons Attribution 3.0 License.
*
* A DOM Manipulation adapter for jQuery.
* @class BrowserID.DOM
* @static
*/
BrowserID.DOM = ( function() {
    var jQuery = typeof( window ) !== 'undefined' && window.jQuery;
    var DOM = {
        /**
        * Get a set of elements that match the selector
        * @method getElements
        * @param {selector || element} selector - if a string, a selector to search for.
        * @return {array} array of elements
        */
        getElements: function( selector ) {
            return jQuery( selector );
        },

        /**
        * Get a set of descendent elements that match the selector
        * @method getDescendentElements
        * @param {string} selector - The selector to search for.
        * @param {element} root - root node to search from
        * @return {array} array of elements
        */
        getDescendentElements: function( selector, root ) {
            return jQuery( root ).find( selector );
        },

        /**
        * Get a set of descendent elements that match the selector, include the root node if it
        *   matches the selector
        * @method getElementsIncludeRoot
        * @param {string} selector - The selector to search for.
        * @param {element} root - root node to search from
        * @return {array} array of elements
        */
        getElementsIncludeRoot: function( selector, root ) {
            root = jQuery( root );
            var set = root.find( selector );
            if( root.is( selector ) ) {
                set = root.add( set );
            }
            return set;
        },

        /**
        * Get the children for an element
        * @method getChildren
        * @param {selector || element} selector - element to get children for
        * @return {array} an array of children
        */
        getChildren: function( selector ) {
            return jQuery( selector ).children();
        },

        /**
        * Get the nth child element
        * @method getNthChild
        * @param {selector || element} selector - element to get children for
        * @param {number} index - index of the child to get
        * @return {element} the nth child if it exists.
        */
        getNthChild: function( selector, index ) {
            return jQuery( selector ).children()[ index ];
        },

        /**
        * Iterate over a set of elements
        * @method forEach
        * @param {Elements} elements - elements to iterate over
        * @param {function} callback - callback to call.  Callback called with: callback( element, index );
        * @param {context} context - context to callback in
        */
        forEach: function( elements, callback, context ) {
            jQuery( elements ).each( function( index, element ) {
                callback.call( context, element, index );
            } );
        },

        /**
        * Remove an element
        * @method removeElement
        * @param {selector || element} selector - element to remove
        */
        removeElement: function( selector ) {
            jQuery( selector ).remove();
        },

        /**
        * Bind to an elements DOM Event
        * @method bindEvent
        * @param {selector || element} element to bind on
        * @param {string} eventName - name of event
        * @param {function} callback - callback to call
        */
        bindEvent: function( element, eventName, callback ) {
            return jQuery( element ).bind( eventName, callback );
        },

        /**
        * Unbind an already bound DOM Event from an element.
        * @method unbindEvent
        * @param {selector || element} element to unbind from
        * @param {string} eventName - name of event
        * @param {function} callback - callback
        */
        unbindEvent: function( element, eventName, callback ) {
            return jQuery( element ).unbind( eventName, callback );
        },

        /**
        * Fire a DOM event on an element
        * @method fireEvent
        * @param {selector || element} element
        * @param {string} type - event to fire
        */
        fireEvent: function( element, type ) {
            return jQuery( element ).trigger( type );
        },

        /**
        * Set the inner value of an element, including input elements
        * @method setInner
        * @param {selector || element} element - element to set
        * @param {string} value - value to set
        */
        setInner: function( element, value ) {
            var target = jQuery( element );
            if( isValBased( target ) ) {
                target.val( value );
            }
            else {
                target.html( value );
            }
        },

        /**
        * Get the inner value of an element, including input elements
        * @method getInner
        * @param {selector || element} element
        * @return {string} inner value of the element
        */
        getInner: function( element ) {
            var target = jQuery( element );
            var retval = '';

            if( isValBased( target ) ) {
                retval = target.val();
            }
            else {
                retval = target.html();
            }
            return retval;
        },

        /**
        * Set an element's attribute.
        * @method setAttr
        * @param {selector || element} element
        * @param {string} attrName - the attribute name
        * @param {string} value - value to set
        */
        setAttr: function( element, attrName, value ) {
            jQuery( element ).attr( attrName, value );
        },

        /**
        * Get an element's attribute.
        * @method getAttr
        * @param {selector || element} element
        * @param {string} attrName - the attribute name
        * @return {string} attribute's value
        */
        getAttr: function( element, attrName ) {
            return jQuery( element ).attr( attrName );
        },

        /**
        * Check if an element has an attribute
        * @method hasAttr
        * @param {selector || element} element
        * @param {string} attrName - the attribute name
        * @return {boolean} true if the element has the attribute, false otw.
        */
        hasAttr: function( element, attrName ) {
            var val = jQuery( element )[ 0 ].getAttribute( attrName );
            return val !== null;
        },

        /**
        * Remove an attribute from an element.
        * @method removeAttr
        * @param {selector || element} element
        * @param {string} attrName - the attribute to remove
        */
        removeAttr: function( element, attrName ) {
            return jQuery( element ).removeAttr( attrName );
        },

        /**
        * Add a class to an element
        * @method addClass
        * @param {selector || element} element
        * @param {string} className
        */
        addClass: function( element, className ) {
            jQuery( element ).addClass( className );
        },

        /**
        * Remove a class from an element
        * @method removeClass
        * @param {selector || element} element
        * @param {string} className
        */
        removeClass: function( element, className ) {
            jQuery( element ).removeClass( className );
        },

        /**
        * Check if an element has a class
        * @method hasClass
        * @param {selector || element} element
        * @param {string} className
        * @return {boolean} true if element has class, false otw.
        */
        hasClass: function( element, className ) {
            return jQuery( element ).hasClass( className );
        },

        /**
        * Create an element
        * @method createElement
        * @param {string} type - element type
        * @param {string} html (optional) - inner HTML
        * @return {element} created element
        */
        createElement: function( type, html ) {
            var element = jQuery( '<' + type + '/>' );
            if( html ) {
                BrowserID.DOM.setInner( element, html );
            }
            return element;
        },

        /**
        * Append an element as the last child of another element
        * @method appendTo
        * @param {selector || element} elementToInsert
        * @param {selector || element} elementToAppendTo
        */
        appendTo: function( elementToInsert, elementToAppendTo ) {
            var el = jQuery(elementToInsert );
            el.appendTo( jQuery( elementToAppendTo ) );
            return el;
        },

        /**
        * Insert an element before another element
        * @method insertBefore
        * @param {selector || element} elementToInsert
        * @param {selector || element} elementToInsertBefore
        */
        insertBefore: function( elementToInsert, elementToInsertBefore ) {
            jQuery( elementToInsert ).insertBefore( elementToInsertBefore );
        },

        /**
        * Insert as the nth child of an element
        * @method insertAsNthChild
        * @param {selector || element} elementToInsert
        * @param {selector || element} parent
        * @param {number} index
        */
        insertAsNthChild: function( elementToInsert, parent, index ) {
            var children = jQuery( parent ).children();
            if( index === children.length ) {
                elementToInsert.appendTo( parent );
            }
            else {
                var insertBefore = children.eq( index );
                elementToInsert.insertBefore( insertBefore );
            }

        },

        /**
         * Focus an element
         * @method focus
         * @param {selelector || element} elementToFocus
         */
        focus: function( elementToFocus ) {
          jQuery( elementToFocus ).focus();
        },

        /**
         * Check the current matched set of elements against
         * a selector or element and return true if at least
         * one of these elements matches the given arguments.
         * @method is
         * @param {selector || element} elementToCheck
         * @param {string} type
         * @returns {boolean} true if elementToCheck matches the specified
         * type, false otw.
         */
        is: function( elementToCheck, type ) {
          return jQuery( elementToCheck ).is( type );
        },

        /**
         * Show an element
         * @method show
         * @param {selector || element} elementToShow
         */
        show: function( elementToShow ) {
          return jQuery( elementToShow ).show();
        },

        /**
         * Hide an element
         * @method hide
         * @param {selector || element} elementToHide
         */
        hide: function( elementToHide ) {
          return jQuery( elementToHide ).hide();
        }
    };

    function isValBased( target ) {
        return target.is( 'input' ) || target.is( 'textarea' );
    }

    return DOM;

}() );
