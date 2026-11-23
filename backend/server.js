require('dotenv').config();
const { validateEnv } = require('./src/config/env');

validateEnv();

const app = require('./src/app');
const port = Number(process.env.PORT || 3000);

app.listen(port, () => console.log(`Debre Birhan Market listening on port ${port}`));
