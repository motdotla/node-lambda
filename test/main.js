var 
assert = require( "assert" ),
program = require( "commander" ),
fs = require("fs"),
lambda = require( "../lib/main" ),
should = require( "should" );

var result;

var program = {
  environment: "development",
  accessKey: "key",
  secretKey: "secret",
  region: "us-east-1",
  functionName: "node-lambda",
  handler: "index.handler",
  mode: "event",
  role: "some:arn:aws:iam::role",
  memorySize: 128,
  timeout: 3,
  description: "",
  runtime: "nodejs"
}

describe( "dotenv", function( ) {
  before( function( ) {
    result = lambda;
  } );

  it( "version should be set", function( ) {
    result.version.should.eql( "0.2.2" ); 
  } );

  describe( "_zipfileTmpPath", function( ) {
    it( "generates a tmp file path", function( ) {
      var zipfile = result._zipfileTmpPath( program );
      zipfile.indexOf( program.functionName ).should.not.eql( -1 );
    } );
   
  } );

  describe( "_params", function( ) {
    it( "appropriately appends the environment to functionName", function( ) {
      var params = result._params( program );
      params.FunctionName.indexOf( program.environment ).should.not.eql( -1 );
    } );
   
  } );
} );
