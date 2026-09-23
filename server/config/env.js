const path = require('path');

// Load server/.env regardless of the command's working directory. Variables
// injected by the hosting platform keep precedence over values in this file.
require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
  quiet: true
});

module.exports = process.env;
