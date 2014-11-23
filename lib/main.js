"use strict";

var 
aws = require( "aws-sdk" ),
exec = require( "child_process" ).exec,
fs = require( "fs" ),
os = require( "os" ),
packageJson = require( "./../package.json" ),
path = require( "path" );

var Lambda = function( ) { 
  this.version = packageJson.version;

  return this;
};

Lambda.prototype.zipfileTmpPath = function( program ) {
  var
  ms_since_epoch = +new Date,
  filename = program.functionName + "-" + ms_since_epoch + ".zip",
  zipfile = path.join( os.tmpDir(), filename );

  return zipfile;
};

Lambda.prototype.run = function( program ) {

  aws.config.update({
    accessKeyId: program.accessKey,
    secretAccessKey: program.secretKey,
    region: program.region
  });

  var 
  lambda = new aws.Lambda( { apiVersion: "2014-11-11" } ),
  zipfile = this.zipfileTmpPath( program );

  console.log( "Generating zip file" );

  // zip up and ignore .git, .dotfiles, and .log files
  exec( "zip -roq " + zipfile + " * -x '.git' -x '*/\.*' -x '*/\*.log'", function( err, stdout, stderr ) {
    if ( err ) {
      throw err;
    }

    console.log( "Reading zip file to memory" );

    var buffer = fs.readFileSync( zipfile );

    var params = {
      FunctionName: program.functionName,
      FunctionZip: buffer,
      Handler: program.handler,
      Mode: program.mode,
      Role: program.role,
      Runtime: program.runtime,
      Description: program.description,
      MemorySize: program.memorySize,
      Timeout: program.timeout
    };

    console.log( "Uploading zip file to AWS Lambda with parameters:" );
    console.log( params );

    lambda.uploadFunction( params, function( err, data ) {
      if ( err ) {
        console.log( err );
      } else {
        console.log( "Zip file done uploading. Results follow:" );
        console.log( data );
      }
    } );

  } );
}

module.exports = new Lambda( );

