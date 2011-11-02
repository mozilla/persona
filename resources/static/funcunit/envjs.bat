@echo off
:: this file is a batch script that invokes loader.bat
:: ex: funcunit/envjs cookbook/qunit.html

:: relative path to this script
set BASE=%~dps0
set CMD=%0

:: classpath
SET CP=%BASE%java/selenium-java-client-driver.jar;%BASE%../steal/rhino/js.jar

:: load the run.js file
SET LOADPATH=%BASE%scripts/run.js

:: call js.bat
CALL %BASE%../steal/rhino/loader.bat %1 %2 %3 %4 %5 %6

:: report errors to CI/build wrapper(s)
if errorlevel 1 exit 1