const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');

const app = express();
dotenv.config();

const port = process.env.PORT || 3000;


app.get('/', (req, res) => {
  res.send('Hello World!');
})

app.post('/movimento', (req, res) => {
    console.log('receiving data ...');

    console.log('headers is ',req.headers);
    console.log('body is ',req.body);
    
    res.send(req.body);
})

app.listen(port, () => {
  console.log(`Server rodando  http://localhost:${port}`);
})