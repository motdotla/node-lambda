# node-lambda

Deploy your node.js application to Amazon Lambda.

[![BuildStatus](https://travis-ci.org/motdotla/node-lambda.png?branch=master)](https://travis-ci.org/motdotla/node-lambda)
[![NPM version](https://badge.fury.io/js/node-lambda.png)](http://badge.fury.io/js/node-lambda)

## Usage

```
npm run deploy
```

## Install

```
npm install node-lambda --save
```

Then add the following to your scripts inside your package.json file.

```
{
  ...
  "scripts": {
    "deploy": "node-lambda -n project-name"
  },
  ...
}
```

Then run it.

```
npm run deploy
```
