require('dotenv').config();
const axios = require('axios');
const winston = require('winston');
const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
});
const httpsProxyAgent = require('https-proxy-agent');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const RUN_MODE = process.env.RUN_MODE;
const PROXY_URL = process.env.PROXY_URL;

const proxyAgent = PROXY_URL ? new httpsProxyAgent(PROXY_URL) : null;

const prompt = 'Реши задачу. Выполни расчеты. Распиши пошагово. Используй шаблон: дано, решение, ответ. Задача:  ';

const getGPTAnswer = async (text, img_links) => {
    const image_content = []
    
    for (const img of img_links) {
        const base64Image = await fetchImageAsBase64(img);
        if (!base64Image) {
            throw new Error('Failed to fetch image');
        }
        image_content.push({
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`
            }
        })
    }

    const data = {
        model: 'gpt-4o',
        messages: [
            {
                "role": "user",
                "content": [
                    {
                    "type": "text",
                    "text": prompt + text
                    },
                    ...image_content
                ]
            },
        ],
        max_tokens: 4096,
    };

    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + OPENAI_API_KEY
        },
        timeout: 30000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
    };

    if (PROXY_URL) {
        config.httpsAgent = new httpsProxyAgent({
            proxy: PROXY_URL,
            rejectUnauthorized: false,
            minVersion: 'TLSv1',
            maxVersion: 'TLSv1.2',
            ciphers: 'ALL',
        });
    }

    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', data, config);
        if (!response.data) {
            throw new Error('Empty response from OpenAI');
        }
        return response.data.choices[0].message.content.trim();
    } catch (error) {
        logger.error('GPT API Error:', {
            message: error.message,
            code: error.code,
            proxy: PROXY_URL || 'not set',
            response: error.response ? {
                status: error.response.status,
                data: error.response.data
            } : 'No response'
        });
        throw error;
    }
}

async function fetchImageAsBase64(url) {
    try {
        const config = { 
            responseType: 'arraybuffer',
            timeout: 30000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        };

        if (PROXY_URL) {
            config.httpsAgent = new httpsProxyAgent({
                proxy: PROXY_URL,
                rejectUnauthorized: false,
                minVersion: 'TLSv1',
                maxVersion: 'TLSv1.2',
                ciphers: 'ALL',
            });
        }

        const response = await axios.get(url, config);
        const base64Image = Buffer.from(response.data, 'binary').toString('base64');
        return base64Image;
    } catch (error) {
        logger.error("Failed to fetch or convert image:", {
            url,
            error: error.message,
            code: error.code,
            proxy: PROXY_URL || 'not set'
        });
        return null;
    }
}

const proccessLatex = (text) => {
    text = text.split("\\[").join("[m]");
    text = text.split("\\]").join("[/m]");
    text = text.split("\\(").join("[m]");
    text = text.split("\\)").join("[/m]");
    text = text.split("\\dfrac").join("\\frac");
    return text
  }

const main = async function (event, _context) {
    const taskText = event.queryStringParameters.text;
    const imgLinks = event.queryStringParameters.img_links || [];

    if (!taskText) {
        console.error('No text');
        return {
            statusCode: 400,
            body: 'No text',
        };
    }

    // Check each img in imgLinks that is correct link
    for (const img of imgLinks) {
        if (!img.startsWith('https://')) {
            console.error('Invalid img link:', img);
            return {
                statusCode: 400,
                body: 'Invalid img link',
            };
        }
    }

    let gptAnswer = await getGPTAnswer(taskText, imgLinks);
    gptAnswer = proccessLatex(gptAnswer);

    logger.info({"question": taskText.slice(0, 20), "answer": gptAnswer.slice(0, 20)})

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json'
        },
        body: { gptAnswer },
    };
};

if (RUN_MODE === 'dev') {
//   main({ queryStringParameters: { text: 'Чему равно 8+15*4?' } }, {})
//     .then(res => console.log(res))
main({ queryStringParameters: { text: 'Что изображено на картинке?', img_links: '' } }, {})
     .then(res => console.log(res))
} else if (RUN_MODE === 'prod') {
  module.exports.handler = main
} else if (RUN_MODE === 'server') {
  module.exports = main
}
