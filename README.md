# node-lambda

![node-lambda](../master/node-lambda.png?raw=true)

Command line tool to locally run and deploy your node.js application to [Amazon Lambda](http://aws.amazon.com/lambda/).

[![BuildStatus](https://travis-ci.org/RebelMail/node-lambda.png?branch=master)](https://travis-ci.org/motdotla/node-lambda)
[![NPM version](https://badge.fury.io/js/node-lambda.png)](http://badge.fury.io/js/node-lambda)

```
node-lambda run
```

## Installation

```
npm install -g node-lambda
```

## Example App

The [node-lambda-template](https://github.com/RebelMail/node-lambda-template) example app makes it easy to get up and running.

## Usage

There are 3 available commands.

```
node-lambda setup
node-lambda run
node-lambda deploy
```

### Commands

#### setup

Initializes the `event.json`, `.env` files, and `deploy.env` files. `event.json` is where you mock your event. `.env.` is where you place your deployment configuration. `deploy.env` has the same format as `.env`, but is used for holding any environment/config variables that you need to be deployed with your code to Lambda but you don't want in version control (e.g. DB connection info).

```
$ node-lambda setup --help

  Usage: run [options]

  Options:

    -h, --help                     output usage information
```

After running setup, it's a good idea to gitignore the generated `event.json` and `.env` files.

```
echo ".env\ndeploy.env\nevent.json" >> .gitignore
```

#### run

Runs your Amazon Lambda index.js file locally. Passes `event.json` data to the Amazon Lambda event object.

```
$ node-lambda run --help

  Usage: run [options]

  Options:

    -h, --help                     output usage information
    -h, --handler [index.handler]  Lambda Handler {index.handler}
```

#### deploy

Bundles and deploys your application up to Amazon Lambda.

```
$ node-lambda deploy --help

  Usage: deploy [options]

  Options:

    -h, --help                        output usage information
    -e, --environment [staging]       Choose environment {development, staging, production}
    -a, --accessKey [your_key]        AWS Access Key
    -s, --secretKey [your_secret]     AWS Secret Key
    -k, --sessionToken [your_token]   AWS Session Token
    -r, --region [us-east-1]          AWS Region(s)
    -n, --functionName [node-lambda]  Lambda FunctionName
    -h, --handler [index.handler]     Lambda Handler {index.handler}
    -c, --mode [event]                Lambda Mode
    -o, --role [your_role]            Amazon Role ARN
    -m, --memorySize [128]            Lambda Memory Size
    -t, --timeout [3]                 Lambda Timeout
    -d, --description [missing]       Lambda Description
    -u, --runtime [nodejs]            Lambda Runtime
    -v, --version [custom-version]    Lambda Version
    -f, --configFile []               Path to file holding secret environment variables (e.g. "deploy.env")`
```

## Custom Environment Variables

AWS Lambda doesn't let you set environment variables for your function, but in many cases you will need to configure your function with secure values that you don't want to check into version control. Use the sample `deploy.env` file in combination with the `--configFile` flag to set environment variables that will be prepended to your compiled Lambda function before it gets uploaded to S3. For example, a DB connection string or encryption key.

## Other AWS Lambda Tools Projects

+ [lambdaws](https://github.com/mentum/lambdaws)
+ [lambdaws-instant-api](https://github.com/mentum/lambdaws-instant-api)

## Contributing

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Added some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request

## Running tests

```
npm install
npm test
```
