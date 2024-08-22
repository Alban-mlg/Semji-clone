const axios = require('axios');
const cheerio = require('cheerio');

async function fetchAndParseContent(url) {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const title = $('title').text();
    const metaDescription = $('meta[name="description"]').attr('content');
    const h1Tags = $('h1').map((i, el) => $(el).text()).get();
    const links = $('a').map((i, el) => $(el).attr('href')).get();
    console.log({ title, metaDescription, h1Tags, links });
  } catch (error) {
    console.error('Failed to fetch or parse the webpage:', error.message);
  }
}

fetchAndParseContent('https://www.rhetores.fr/');
