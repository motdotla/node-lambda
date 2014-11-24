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

It's a good idea to gitignore the generated `event.json` and `.env` file. Ro that with the following command:

```
echo ".env\nevent.json" >> .gitignore
```

### node-lambda run

```
$ node-lambda run --help

  Usage: run [options]

  Options:

    -h, --help                     output usage information
    -h, --handler [index.handler]  Lambda Handler {index.handler}
```

### node-lambda deploy

```
$ node-lambda deploy --help

  Usage: deploy [options]

  Options:

    -h, --help                        output usage information
    -e, --environment [staging]       Choose environment {development, stating, production}
    -a, --accessKey [your_key]        AWS Access Key
    -s, --secretKey [your_secret]     AWS Secret Key
    -r, --region [us-east-1]          AWS Region
    -n, --functionName [node-lambda]  Lambda FunctionName
    -h, --handler [index.handler]     Lambda Handler {index.handler}
    -m, --mode [event]                Lambda Mode
    -o, --role [your_role]            Amazon role
    -m, --memorySize [128]            Lambda Memory Size
    -t, --timeout [3]                 Lambda Timeout
    -d, --description [missing]       Lambda Description
    -u, --runtime [nodejs]            Lambda Runtime
```
