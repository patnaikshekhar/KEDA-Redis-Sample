const redis = require('redis')

const ADDRESS = process.env.REDIS_HOST
const HOST = ADDRESS.split(':')[0]
const PORT = ADDRESS.split(':')[1]

const client = redis.createClient({ 
  host: HOST,
  port: PORT,
  password: process.env.REDIS_PASSWORD
})

const LIST_NAME = process.env.LIST_NAME
const POLL_TIME = 20000

const run = () => {
  console.log('Waiting...')
  // Wait for POLL_TIME then pop from list
  setTimeout(() => {
    client.RPOP(LIST_NAME, (err, val) => {
      if (err) {
        console.error(err)
      } else {
        if (val) {
          console.log('Got value from list', val)
        } else {
          console.log('List is empty')
        }
      }
      run() // Start polling again
    })
  }, POLL_TIME)
}

run()



