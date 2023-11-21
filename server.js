require('dotenv').config();
const express = require('express')
const main = require('./dist/index')
const app = express()

const SERVER_PORT = process.env.SERVER_PORT
const SERVER_ACCESS_KEY = process.env.SERVER_ACCESS_KEY;

app.get('/', async (req, res) => {
  const accessKey = req.query.access_key

  if(accessKey !== SERVER_ACCESS_KEY) {
    res.status(403).send('Access denied!')
    return;
  }

  const text = req.query.text

  if(!text.trim().length) {
    res.status(400).send('Empty text')
    return;
  }

  const gptAnswer = await main({ queryStringParameters: { text } }, {})
  res.send(gptAnswer.body)
})

app.listen(SERVER_PORT, () => {
  console.log(`Task helper app listening on port ${SERVER_PORT}`)
})
