/**
@page setup 1. Getting Set Up
@parent FuncUnit

## Getting Started with Generators

This guide assumes you're using a full JavaScript download with Steal.  The easiest way to get started 
is to use generators to get a basic test in place.  

From a command line, cd to the root of the your JMVC directory and run:

@codestart
./js jquery/generate/controller Company.Widget
@codeend

This will create the following folder structure:

@image jmvc/images/funcunitfolder.png

<br />Open funcunit.html in a browser:

@image jmvc/images/funcunithtml.png

<br />If your popup blocker is off, a separate page (the application) opens in a separate window, an assertion runs, and your test passes.

To add your own test, open widget_test.js and modify the existing test or add your own.

Note that the jquery/generate/app or jquery/generate/plugin generators will create similar basic funcunit pages.  

## What's Actually Happening

Funcunit.html is doing the following:

1. Loading QUnit's CSS.
2. Loading steal.js and telling it to load widget_test.js as its top level JS file. 
3. Adding the necessary HTML that QUnit needs.

Steal.js loads first.  It loads widget_test.js, which:

1. Loads funcunit, and all its dependencies (including QUnit).
2. Defines a very basic test.

 */