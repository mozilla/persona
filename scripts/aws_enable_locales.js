#!/usr/bin/env node

const exec = require('child_process').exec,
fs = require('fs'),
optimist = require('optimist'),
path = require('path');


const argv = optimist
  .usage('Usage: $0 path/to/anyfile_with_locales.json\n\n' +
    ' -a, -c, -u are for development of this script outside of aws and ' +
    'can be ignored.\n\n' +
    'During development, create a sample config.json and ' +
    'include var_path in it.')
  .options('a', {
    alias: 'aws-config',
    "default": '/home/app/code/config/aws.json',
    describe: 'Path to aws.json config file'
  })
  .options('c', {
    alias: 'compress',
    "default": '/home/app/code/scripts/compress',
    describe: 'Path to compress script'
  })
  .options('u', {
    alias: 'update-config',
    "default": '/home/app/config.json',
    describe: 'The config file we should update. ' +
      'We will overrite any existing locale setting'
  })
  .argv;


var updateConfig = argv.u[0] === '/' ?
  argv.u : path.join(process.cwd(), argv.u);
var awsConfig = argv.a[0] === '/' ?
  argv.a : path.join(process.cwd(), argv.a);
var compressPath = argv.c[0] === '/' ?
  argv.c : path.join(process.cwd(), argv.c);

console.log(argv._.length);
if (argv._.length !== 1) {

  optimist.showHelp();
  process.exit(1);
}

function readUpdateConfig(err, raw) {
  if (err) {
    optimist.showHelp();
    console.error(err);
    process.exit(2);
  }
  var config = JSON.parse(raw);
  readLocaleConfig(config);
}

function readLocaleConfig(updateConfigValues) {
  var localeConfig = path.join(process.cwd(), argv._[0]);
  console.log('Pulling locales from', localeConfig);
  fs.readFile(localeConfig, 'utf8', function(err, raw) {
    if (err) {
      optimist.showHelp();
      console.error(err);
      process.exit(3);
    }
    var config = JSON.parse(raw);

    updateConfigValues.supported_languages = config.supported_languages;

    console.log('Writing', updateConfig);
    var newJson = JSON.stringify(updateConfigValues, null, 4);
    fs.writeFile(updateConfig, newJson, 'utf8', function(err) {
      if (err) {
        console.error(err);
        process.exit(4);
      } else {
        compress();
      }
    });
  });
}

function compress() {
  console.log('Starting node', compressPath);
  exec('node ' + compressPath, {
    env: {
      CONFIG_FILES: [awsConfig, updateConfig].join(',')
    }
  }, function(err, stdout, stderr) {
    console.log(stdout);
    console.error(stderr);
    if (err) {
      console.error(err);
      process.exit(5);
    } else {
      restartAll();
    }
  });
}

function restartAll() {
  console.log('forever restartall');
  exec('/home/app/node_modules/.bin/forever restartall',
       {}, function(err, stdout, stderr) {
    console.log(stdout);
    console.error(stderr);
    if (err) {
      console.error(err);
      process.exit(6);
    } else {
      console.log('Finished enabling locales');
    }
  });
}

fs.readFile(updateConfig, 'utf8', readUpdateConfig);