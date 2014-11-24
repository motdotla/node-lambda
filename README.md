# node-lambda

Deploy your node.js application to Amazon Lambda.

[![BuildStatus](https://travis-ci.org/RebelMail/node-lambda.png?branch=master)](https://travis-ci.org/motdotla/node-lambda)
[![NPM version](https://badge.fury.io/js/node-lambda.png)](http://badge.fury.io/js/node-lambda)

## Installation

```
npm install -g node-lambda
```

## Usage

Run your Amazon Lambda app locally.

```
node-lambda run
```

When ready to deploy for the first time, run the following.

```
node-lambda setup
echo ".env\nevent.json" >> .gitignore
node-lambda deploy -e staging
```

You can subsequenetly, just call the following.

```
node-lambda deploy -e staging
```

### Command line flags

You can opt to use command line flags instead of a `.env.` file.

#### run [flags]
```
node-lambda run [flags]
```

##### Example

```
./node_modules/.bin/node-lambda run --help

  Usage: run [options]

  Options:

    -h, --help                     output usage information
    -h, --handler [index.handler]  Lambda Handler {index.handler}
```

#### deploy [flags]

```
node-lambda deploy [flags]
```

##### Example

```
./node_modules/.bin/node-lambda deploy --help

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
