require('dotenv').config();

module.exports = {
  useCliConfig: true,
  functionName: 'chat-gpt-task-helper',
  deploy: {
    files: [ 'package*.json', 'dist/**' ],
    handler: 'dist/index.handler',
    runtime: 'nodejs16',
    timeout: 300,
    memory: 128,
    environment: {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      RUN_MODE: 'prod'
    },
  },
};