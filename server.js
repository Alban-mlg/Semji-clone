const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());

app.get('/proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).send('URL parameter is required');
    }

    const response = await axios.get(url);
    res.send(response.data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).send('Error fetching the requested URL');
  }
});

app.listen(port, () => {
  console.log(`Proxy server running on port ${port}`);
});
