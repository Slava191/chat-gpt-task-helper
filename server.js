require('dotenv').config();
const express = require('express');
const https = require('https');
const fs = require('fs');
const cors = require('cors');
const main = require('./dist/index');
const app = express();

app.use(cors());

const SERVER_PORT = process.env.SERVER_PORT;
const SERVER_ACCESS_KEY = process.env.SERVER_ACCESS_KEY;
const sslCrtDir = process.env.SSL_CRT_DIR;
const sslCrtName = process.env.SSL_CRT_NAME;
const sslCrt = sslCrtDir + '/' + sslCrtName;

const httpsOptions = {
    key: fs.readFileSync(sslCrt + '.key'),
    cert: fs.readFileSync(sslCrt + '.crt'),
    ca: fs.readFileSync(sslCrt + '.ca')
};

app.get('/', async function(req, res) {
    try {
        const accessKey = req.query.access_key;

        if (accessKey !== SERVER_ACCESS_KEY) {
            return res.status(403).json({ error: 'Access denied!' });
        }

        const text = req.query.text;
        const imgLinksString = req.query.img_links;
        const img_links = imgLinksString ? imgLinksString.split(',') : [];

        if (!text || !text.trim().length) {
            return res.status(400).json({ error: 'Empty text' });
        }

        const response = await main({ queryStringParameters: { text, img_links } }, {});
        res.json(JSON.parse(response.body));
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

https.createServer(httpsOptions, app).listen(SERVER_PORT, function() {
    console.log('Task helper app listening on port ' + SERVER_PORT);
});
