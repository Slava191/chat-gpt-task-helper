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

const getGPTAnswer = async (text) => {
    const data = {
        model: 'gpt-4',
        messages: [
            {
                role: 'user',
                content: prompt + text
            }
        ]
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

const main = async function (event, _context) {
    const taskText = event.queryStringParameters.text;

    if (!taskText) {
        console.error('No text');
    }

    const gtpAnswer = await getGPTAnswer(taskText);

    logger.info({"question": taskText.slice(0, 20), "answer": gtpAnswer.slice(0, 20)})

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json'
        },
        body: { gtpAnswer },
    };
};

if (RUN_MODE === 'dev') {
  main({ queryStringParameters: { text: 'Чему равно 8+15*4?' } }, {})
    .then(res => console.log(res))
} else if (RUN_MODE === 'prod') {
  module.exports.handler = main
}
