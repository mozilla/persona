#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "$0" )" && pwd )"
BASEDIR=$(dirname $SCRIPT_DIR)
export PATH=$PATH:$SCRIPT_DIR/../node_modules/.bin

VOWS=`which vows 2> /dev/null`
if [ ! -x "$VOWS" ]; then
    echo "vows not found in your path.  try:  npm install"
    exit 1
fi

# vows hates absolute paths.  sheesh.
cd $BASEDIR

for env in test_json test_mysql ; do
  export NODE_ENV=$env
  $SCRIPT_DIR/test_db_connectivity.js
  if [ $? = 0 ] ; then 
      echo "Testing with NODE_ENV=$env"
      for file in browserid/tests/*.js ; do
          echo $file
          vows $file
          if [[ $? != 0 ]] ; then
              exit 1
          fi
      done
  else
      echo "CANNOT TEST '$env' ENVIRONMENT: can't connect to the database"
  fi
done
