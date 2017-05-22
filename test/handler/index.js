'use strict';

exports.handler = (event, context, callback) => {
  // It changes to a boolean value with `!!`
  context.callbackWaitsForEmptyEventLoop =
    !!event.callbackWaitsForEmptyEventLoop;

  if (event.asyncTest)
    setTimeout(() => console.log('sleep 3500 msec'), 3500);

  eval(event.callbackCode);
};
