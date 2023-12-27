// For development/testing purposes
export const handler = (event, context, callback) => {
  console.log('Running index.handler (mjs)')
  console.log('==================================')
  console.log('event', event)
  console.log('==================================')
  console.log('Stopping index.handler (mjs)')
  callback(null)
}
