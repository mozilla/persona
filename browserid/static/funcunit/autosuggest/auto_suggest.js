    /**
    * o------------------------------------------------------------------------------o
    * | This package is licensed under the Phpguru license. A quick summary is       |
    * | that for commercial use, there is a small one-time licensing fee to pay. For |
    * | registered charities and educational institutes there is a reduced license   |
    * | fee available. You can read more  at:                                        |
    * |                                                                              |
    * |                  http://www.phpguru.org/static/license.html                  |
    * o------------------------------------------------------------------------------o
    */

    /**
    * Global vars
    */
    __AutoComplete = new Array();

    /**
    * Basic UA detection
    */
    if (navigator.userAgent.match(/Opera/)) {
        isIE          = false;
        isOpera       = true;
        opera_version = Number(navigator.userAgent.match(/Version\/([0-9.]+)/)[1]);

    } else {

        isIE          = document.all ? true : false;
        isOpera       = false;
        opera_version = 0;
    }


    /**
    * Attachs the autocomplete object to a form element. Sets
    * onkeypress event on the form element.
    * 
    * @param string formElement Name of form element to attach to
    * @param array  data        Array of strings of which to use as the autocomplete data
    */
    function AutoComplete_Create (id, data)
    {
        __AutoComplete[id] = {'data':data,
                              'isVisible':false,
                              'element':document.getElementById(id),
                              'dropdown':null,
                              'highlighted':null};

        __AutoComplete[id]['element'].setAttribute('autocomplete', 'off');
        __AutoComplete[id]['element'].onkeydown  = function(e) {return AutoComplete_KeyDown(this.getAttribute('id'), e);}
        __AutoComplete[id]['element'].onkeyup    = function(e) {return AutoComplete_KeyUp(this.getAttribute('id'), e);}
        __AutoComplete[id]['element'].onkeypress = function(e) {if (!e) e = window.event;if (e.keyCode == 13) return false;}
        __AutoComplete[id]['element'].ondblclick = function(e) {AutoComplete_ShowDropdown(this.getAttribute('id'));}
        __AutoComplete[id]['element'].onclick    = function(e) {if (!e) e = window.event; e.cancelBubble = true; e.returnValue = false;}

        // Hides the dropdowns when document clicked
        var docClick = function()
        {
           for (id in __AutoComplete) {
               AutoComplete_HideDropdown(id);
           }
        }

        if (document.addEventListener) {
            document.addEventListener('click', docClick, false);
        } else if (document.attachEvent) {
            document.attachEvent('onclick', docClick, false);
        }


        // Max number of items shown at once
        if (arguments[2] != null) {
            __AutoComplete[id]['maxitems'] = arguments[2];
            __AutoComplete[id]['firstItemShowing'] = 0;
            __AutoComplete[id]['lastItemShowing']  = arguments[2] - 1;
        }
        
        AutoComplete_CreateDropdown(id);
        
        // Prevent select dropdowns showing thru
        if (isIE) {
            __AutoComplete[id]['iframe'] = document.createElement('iframe');
            __AutoComplete[id]['iframe'].id = id +'_iframe';
            __AutoComplete[id]['iframe'].style.position = 'absolute';
            __AutoComplete[id]['iframe'].style.top = '0';
            __AutoComplete[id]['iframe'].style.left = '0';
            __AutoComplete[id]['iframe'].style.width = '0px';
            __AutoComplete[id]['iframe'].style.height = '0px';
            __AutoComplete[id]['iframe'].style.zIndex = '98';
            __AutoComplete[id]['iframe'].style.visibility = 'hidden';
            
            __AutoComplete[id]['element'].parentNode.insertBefore(__AutoComplete[id]['iframe'], __AutoComplete[id]['element']);
        }
    }


    /**
    * Creates the dropdown layer
    * 
    * @param string id The form elements id. Used to identify the correct dropdown.
    */
    function AutoComplete_CreateDropdown(id)
    {
        var left  = AutoComplete_GetLeft(__AutoComplete[id]['element']);
        var top   = AutoComplete_GetTop(__AutoComplete[id]['element']) + __AutoComplete[id]['element'].offsetHeight;
        var width = __AutoComplete[id]['element'].offsetWidth;
    
        __AutoComplete[id]['dropdown'] = document.createElement('div');
        __AutoComplete[id]['dropdown'].className = 'autocomplete'; // Don't use setAttribute()
    
        __AutoComplete[id]['element'].parentNode.insertBefore(__AutoComplete[id]['dropdown'], __AutoComplete[id]['element']);
        
        // Position it
        __AutoComplete[id]['dropdown'].style.left       = left + 'px';
        __AutoComplete[id]['dropdown'].style.top        = top + 'px';
        __AutoComplete[id]['dropdown'].style.width      = width + 'px';
        __AutoComplete[id]['dropdown'].style.zIndex     = '99';
        __AutoComplete[id]['dropdown'].style.visibility = 'hidden';
    }
    
    
    /**
    * Gets left coord of given element
    * 
    * @param object element The element to get the left coord for
    */
    function AutoComplete_GetLeft(element)
    {
        var curNode = element;
        var left    = 0;

        do {
            left += curNode.offsetLeft;
            
            curNode = curNode.offsetParent;

        } while(curNode.tagName.toLowerCase() != 'body' && curNode.style.position != 'fixed');

        return left;
    }
    
    /**
    * Gets top coord of given element
    * 
    * @param object element The element to get the top coord for
    */
    function AutoComplete_GetTop(element)
    {
        var curNode = element;
        var top    = 0;


        do {
            top += curNode.offsetTop;
            curNode = curNode.offsetParent;

        } while(curNode.tagName.toLowerCase() != 'body' && curNode.style.position != 'fixed');

        return top;
    }

    
    /**
    * Shows the dropdown layer
    * 
    * @param string id The form elements id. Used to identify the correct dropdown.
    */
    function AutoComplete_ShowDropdown(id)
    {
        AutoComplete_HideAll();

        var value = __AutoComplete[id]['element'].value;
        var toDisplay = new Array();
        var newDiv    = null;
        var text      = null;
        var numItems  = __AutoComplete[id]['dropdown'].childNodes.length;

        // Remove all child nodes from dropdown
        while (__AutoComplete[id]['dropdown'].childNodes.length > 0) {
            __AutoComplete[id]['dropdown'].removeChild(__AutoComplete[id]['dropdown'].childNodes[0]);
        }

        // Go thru data searching for matches
        for (i=0; i<__AutoComplete[id]['data'].length; ++i) {
            if (__AutoComplete[id]['data'][i].indexOf(value) != -1) {
                toDisplay[toDisplay.length] = __AutoComplete[id]['data'][i];
            }
        }
        
        // No matches?
        if (toDisplay.length == 0) {
            AutoComplete_HideDropdown(id);
            return;
        }



        // Add data to the dropdown layer
        for (i=0; i<toDisplay.length; ++i) {
            newDiv = document.createElement('div');
            newDiv.className = 'autocomplete_item'; // Don't use setAttribute()
            newDiv.setAttribute('id', 'autocomplete_item_' + i);
            newDiv.setAttribute('index', i);
            newDiv.style.zIndex = '99';
            
             // Scrollbars are on display ?
            if (toDisplay.length > __AutoComplete[id]['maxitems'] && navigator.userAgent.indexOf('MSIE') == -1) {
                newDiv.style.width = __AutoComplete[id]['element'].offsetWidth - 22 + 'px';
            }

            newDiv.onmouseover = function() {AutoComplete_HighlightItem(__AutoComplete[id]['element'].getAttribute('id'), this.getAttribute('index'));};
            newDiv.onclick     = function() {AutoComplete_SetValue(__AutoComplete[id]['element'].getAttribute('id')); AutoComplete_HideDropdown(__AutoComplete[id]['element'].getAttribute('id'));}
            
            text   = document.createTextNode(toDisplay[i]);
            newDiv.appendChild(text);
            
            __AutoComplete[id]['dropdown'].appendChild(newDiv);
        }
        
        
        // Too many items?
        if (toDisplay.length > __AutoComplete[id]['maxitems']) {
            __AutoComplete[id]['dropdown'].style.height = (__AutoComplete[id]['maxitems'] * 15) + 2 + 'px';
        
        } else {
            __AutoComplete[id]['dropdown'].style.height = '';
        }

        
        /**
        * Set left/top in case of document movement/scroll/window resize etc
        */
        __AutoComplete[id]['dropdown'].style.left = AutoComplete_GetLeft(__AutoComplete[id]['element']);
        __AutoComplete[id]['dropdown'].style.top  = AutoComplete_GetTop(__AutoComplete[id]['element']) + __AutoComplete[id]['element'].offsetHeight;


        // Show the iframe for IE
        if (isIE) {
            __AutoComplete[id]['iframe'].style.top    = __AutoComplete[id]['dropdown'].style.top;
            __AutoComplete[id]['iframe'].style.left   = __AutoComplete[id]['dropdown'].style.left;
            __AutoComplete[id]['iframe'].style.width  = __AutoComplete[id]['dropdown'].offsetWidth;
            __AutoComplete[id]['iframe'].style.height = __AutoComplete[id]['dropdown'].offsetHeight;
            
            __AutoComplete[id]['iframe'].style.visibility = 'visible';
        }


        // Show dropdown
        if (!__AutoComplete[id]['isVisible']) {
            __AutoComplete[id]['dropdown'].style.visibility = 'visible';
            __AutoComplete[id]['isVisible'] = true;
        }

        
        // If now showing less items than before, reset the highlighted value
        if (__AutoComplete[id]['dropdown'].childNodes.length != numItems) {
            __AutoComplete[id]['highlighted'] = null;
        }
    }
    
    
    /**
    * Hides the dropdown layer
    * 
    * @param string id The form elements id. Used to identify the correct dropdown.
    */
    function AutoComplete_HideDropdown(id)
    {
        if (__AutoComplete[id]['iframe']) {
            __AutoComplete[id]['iframe'].style.visibility = 'hidden';
        }


        __AutoComplete[id]['dropdown'].style.visibility = 'hidden';
        __AutoComplete[id]['highlighted'] = null;
        __AutoComplete[id]['isVisible']   = false;
    }
    
    
    /**
    * Hides all dropdowns
    */
    function AutoComplete_HideAll()
    {
        for (id in __AutoComplete) {
            AutoComplete_HideDropdown(id);
        }
    }
    
    
    /**
    * Highlights a specific item
    * 
    * @param string id    The form elements id. Used to identify the correct dropdown.
    * @param int    index The index of the element in the dropdown to highlight
    */
    function AutoComplete_HighlightItem(id, index)
    {
        if (__AutoComplete[id]['dropdown'].childNodes[index]) {
            for (var i=0; i<__AutoComplete[id]['dropdown'].childNodes.length; ++i) {
                if (__AutoComplete[id]['dropdown'].childNodes[i].className == 'autocomplete_item_highlighted') {
                    __AutoComplete[id]['dropdown'].childNodes[i].className = 'autocomplete_item';
                }
            }
            
            __AutoComplete[id]['dropdown'].childNodes[index].className = 'autocomplete_item_highlighted';
            __AutoComplete[id]['highlighted'] = index;
        }
    }


    /**
    * Highlights the menu item with the given index
    * 
    * @param string id    The form elements id. Used to identify the correct dropdown.
    * @param int    index The index of the element in the dropdown to highlight
    */
    function AutoComplete_Highlight(id, index)
    {
        // Out of bounds checking
        if (index == 1 && __AutoComplete[id]['highlighted'] == __AutoComplete[id]['dropdown'].childNodes.length - 1) {
            __AutoComplete[id]['dropdown'].childNodes[__AutoComplete[id]['highlighted']].className = 'autocomplete_item';
            __AutoComplete[id]['highlighted'] = null;
        
        } else if (index == -1 && __AutoComplete[id]['highlighted'] == 0) {
            __AutoComplete[id]['dropdown'].childNodes[0].className = 'autocomplete_item';
            __AutoComplete[id]['highlighted'] = __AutoComplete[id]['dropdown'].childNodes.length;
        }

        // Nothing highlighted at the moment
        if (__AutoComplete[id]['highlighted'] == null) {
            __AutoComplete[id]['dropdown'].childNodes[0].className = 'autocomplete_item_highlighted';
            __AutoComplete[id]['highlighted'] = 0;

        } else {
            if (__AutoComplete[id]['dropdown'].childNodes[__AutoComplete[id]['highlighted']]) {
                __AutoComplete[id]['dropdown'].childNodes[__AutoComplete[id]['highlighted']].className = 'autocomplete_item';
            }

            var newIndex = __AutoComplete[id]['highlighted'] + index;

            if (__AutoComplete[id]['dropdown'].childNodes[newIndex]) {
                __AutoComplete[id]['dropdown'].childNodes[newIndex].className = 'autocomplete_item_highlighted';
                
                __AutoComplete[id]['highlighted'] = newIndex;
            }
        }
    }


    /**
    * Sets the input to a given value
    * 
    * @param string id    The form elements id. Used to identify the correct dropdown.
    */
    function AutoComplete_SetValue(id)
    {
        __AutoComplete[id]['element'].value = __AutoComplete[id]['dropdown'].childNodes[__AutoComplete[id]['highlighted']].innerHTML;
    }
    
    
    /**
    * Checks if the dropdown needs scrolling
    * 
    * @param string id    The form elements id. Used to identify the correct dropdown.
    */
    function AutoComplete_ScrollCheck(id)
    {
        // Scroll down, or wrapping around from scroll up
        if (__AutoComplete[id]['highlighted'] > __AutoComplete[id]['lastItemShowing']) {
            __AutoComplete[id]['firstItemShowing'] = __AutoComplete[id]['highlighted'] - (__AutoComplete[id]['maxitems'] - 1);
            __AutoComplete[id]['lastItemShowing']  = __AutoComplete[id]['highlighted'];
        }
        
        // Scroll up, or wrapping around from scroll down
        if (__AutoComplete[id]['highlighted'] < __AutoComplete[id]['firstItemShowing']) {
            __AutoComplete[id]['firstItemShowing'] = __AutoComplete[id]['highlighted'];
            __AutoComplete[id]['lastItemShowing']  = __AutoComplete[id]['highlighted'] + (__AutoComplete[id]['maxitems'] - 1);
        }
        
        __AutoComplete[id]['dropdown'].scrollTop = __AutoComplete[id]['firstItemShowing'] * 15;
    }


    /**
    * Function which handles the keypress event
    * 
    * @param string id    The form elements id. Used to identify the correct dropdown.
    */
    function AutoComplete_KeyDown(id)
    {
        // Mozilla
        if (arguments[1] != null) {
            event = arguments[1];
        }

        var keyCode = event.keyCode;

        switch (keyCode) {

            // Return/Enter
            case 13:
                if (__AutoComplete[id]['highlighted'] != null) {
                    AutoComplete_SetValue(id);
                    AutoComplete_HideDropdown(id);
                }
                
                event.returnValue = false;
                event.cancelBubble = true;
                break;

            // Escape
            case 27:
                AutoComplete_HideDropdown(id);
                event.returnValue = false;
                event.cancelBubble = true;
                break;
            
            // Up arrow
            case 38:
                if (!__AutoComplete[id]['isVisible']) {
                    AutoComplete_ShowDropdown(id);
                }
                
                AutoComplete_Highlight(id, -1);
                AutoComplete_ScrollCheck(id, -1);
                return false;
                break;
            
            // Tab
            case 9:
                if (__AutoComplete[id]['isVisible']) {
                    AutoComplete_HideDropdown(id);
                }
                return;
            
            // Down arrow
            case 40:
                if (!__AutoComplete[id]['isVisible']) {
                    AutoComplete_ShowDropdown(id);
                }
                
                AutoComplete_Highlight(id, 1);
                AutoComplete_ScrollCheck(id, 1);
                return false;
                break;
        }
    }


    /**
    * Function which handles the keyup event
    * 
    * @param string id    The form elements id. Used to identify the correct dropdown.
    */
    function AutoComplete_KeyUp(id)
    {
        // Mozilla
        if (arguments[1] != null) {
            event = arguments[1];
        }

        var keyCode = event.keyCode;

        switch (keyCode) {
            case 13:
                event.returnValue = false;
                event.cancelBubble = true;
                break;

            case 27:
                AutoComplete_HideDropdown(id);
                event.returnValue = false;
                event.cancelBubble = true;
                break;
            
            case 38:
            case 40:
                return false;
                break;

            default:
                AutoComplete_ShowDropdown(id);
                break;
        }
    }
    
    /**
    * Returns whether the dropdown is visible
    * 
    * @param string id    The form elements id. Used to identify the correct dropdown.
    */
    function AutoComplete_isVisible(id)
    {
        return __AutoComplete[id]['dropdown'].style.visibility == 'visible';
    }