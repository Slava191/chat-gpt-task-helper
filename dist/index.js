require('dotenv').config();
const axios = require('axios');
const winston = require('winston');
const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
});
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const RUN_MODE = process.env.RUN_MODE;
const prompt = 'Реши задачу. Выполни расчеты. Распиши пошагово. Не используй LaTeX для формул. Если задача по физике или по геометрии, то используй шаблон: дано, решение, ответ. Задача:  ';

const getGPTAnswer = async (text, img_links) => {
    const image_content = []
    
    for (const img of img_links) {
        const base64Image = await fetchImageAsBase64(img);
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
        }
    };

    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', data, config);
        return response.data.choices[0].message.content.trim();
    } catch (error) {
        console.error(error);
    }
}

async function fetchImageAsBase64(url) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const base64Image = Buffer.from(response.data, 'binary').toString('base64');
        return base64Image;
    } catch (error) {
        console.error("Failed to fetch or convert image:", error);
        return null;
    }
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

    const gptAnswer = await getGPTAnswer(taskText, imgLinks);

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
main({ queryStringParameters: { text: 'Что изображено на картинке?', img_links: ['1617354554186.png'] } }, {})
     .then(res => console.log(res))
} else if (RUN_MODE === 'prod') {
  module.exports.handler = main
} else if (RUN_MODE === 'server') {
  module.exports = main
}
