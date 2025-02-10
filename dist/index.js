require('dotenv').config();
const axios = require('axios');
const winston = require('winston');
const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
});
const HttpsProxyAgent = require('https-proxy-agent');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const RUN_MODE = process.env.RUN_MODE;
const PROXY_URL = process.env.PROXY_URL;

const prompt = 'Реши задачу. Выполни расчеты. Распиши пошагово. Используй шаблон: дано, решение, ответ. Задача:  ';

// Создаем базовую конфигурацию axios
const axiosConfig = {
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
    }
};

if (PROXY_URL) {
    axiosConfig.proxy = false;
    axiosConfig.httpsAgent = new HttpsProxyAgent(PROXY_URL);
}

const getGPTAnswer = async (text, img_links) => {
    const image_content = [];
    
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
        });
    }

    const data = {
        model: 'gpt-4-vision-preview',
        messages: [{
            role: "user",
            content: [{
                type: "text",
                text: prompt + text
            },
            ...image_content]
        }],
        max_tokens: 4096
    };

    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            data,
            axiosConfig
        );
        return response.data.choices[0].message.content.trim();
    } catch (error) {
        logger.error('GPT API Error:', error.message);
        throw error;
    }
};

async function fetchImageAsBase64(url) {
    try {
        const imageConfig = {
            ...axiosConfig,
            responseType: 'arraybuffer'
        };
        
        const response = await axios.get(url, imageConfig);
        return Buffer.from(response.data, 'binary').toString('base64');
    } catch (error) {
        logger.error('Image fetch error:', error.message);
        return null;
    }
}

const proccessLatex = (text) => {
    return text
        .replace(/\\\[/g, '[m]')
        .replace(/\\\]/g, '[/m]')
        .replace(/\\\(/g, '[m]')
        .replace(/\\\)/g, '[/m]')
        .replace(/\\dfrac/g, '\\frac');
};

const main = async function (event, _context) {
    try {
        const taskText = event.queryStringParameters.text;
        const imgLinks = event.queryStringParameters.img_links || [];

        if (!taskText) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: 'No text' })
            };
        }

        for (const img of imgLinks) {
            if (!img.startsWith('https://')) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ error: 'Invalid img link' })
                };
            }
        }

        let gptAnswer = await getGPTAnswer(taskText, imgLinks);
        gptAnswer = proccessLatex(gptAnswer);

        logger.info({
            question: taskText.slice(0, 20),
            answer: gptAnswer.slice(0, 20)
        });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ gptAnswer })
        };
    } catch (error) {
        logger.error('Main error:', error.message);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

if (RUN_MODE === 'dev') {
    main({ queryStringParameters: { text: 'Что изображено на картинке?', img_links: [] } }, {})
        .then(res => console.log(res));
} else if (RUN_MODE === 'prod') {
    module.exports.handler = main;
} else if (RUN_MODE === 'server') {
    module.exports = main;
}
