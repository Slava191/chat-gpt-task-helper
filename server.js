require('dotenv').config();
const express = require('express')
const https = require('https');
const fs = require('fs');
const cors = require('cors');
const main = require('./dist/index')
const app = express()

app.use(cors({
  origin: '*'
}));

const SERVER_PORT = process.env.SERVER_PORT
const SERVER_ACCESS_KEY = process.env.SERVER_ACCESS_KEY;

const sslCrtDir = process.env.SSL_CRT_DIR
const sslCrtName = process.env.SSL_CRT_NAME

const sslCrt = `${sslCrtDir}/${sslCrtName}`

const httpsOptions = {
    key: fs.readFileSync(`${sslCrt}.key`),
    cert: fs.readFileSync(`${sslCrt}.crt`),
    ca: fs.readFileSync(`${sslCrt}.ca`)
};

app.get('/', async (req, res) => {
  const accessKey = req.query.access_key

  if(accessKey !== SERVER_ACCESS_KEY) {
    res.status(403).send('Access denied!')
    return;
  }

  const text = req.query.text
  const imgLinksString = req.query.img_links
  const img_links = imgLinksString ? imgLinksString.split(',') : []

  if(!text.trim().length) {
    res.status(400).send('Empty text')
    return;
  }

  const gptAnswer = await main({ queryStringParameters: { text, img_links } }, {})
  res.send(gptAnswer.body)
})

const server = https.createServer(httpsOptions, app);

server.listen(SERVER_PORT, () => {
  console.log(`Task helper app listening on port ${SERVER_PORT}`)
})
