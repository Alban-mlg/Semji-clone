import React, { useState } from 'react';
import axios from 'axios';
import * as cheerio from 'cheerio';
import {
  ChakraProvider,
  Box,
  VStack,
  Input,
  Button,
  Text,
  Heading,
  Container,
} from '@chakra-ui/react';

interface ParsedContent {
  title: string;
  metaDescription: string;
  h1Tags: string[];
  links: string[];
}

function App() {
  const [url, setUrl] = useState('');
  const [parsedContent, setParsedContent] = useState<ParsedContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAndParseContent = async () => {
    try {
      setError(null);
      const response = await axios.get(`http://localhost:3001/proxy?url=${encodeURIComponent(url)}`);
      const html = response.data;
      const $ = cheerio.load(html);

      const parsedData: ParsedContent = {
        title: $('title').text(),
        metaDescription: $('meta[name="description"]').attr('content') || '',
        h1Tags: $('h1').map((_, el) => $(el).text()).get(),
        links: $('a').map((_, el) => $(el).attr('href')).get(),
      };

      setParsedContent(parsedData);
    } catch (err) {
      setError('Failed to fetch or parse the webpage. Please check the URL and try again.');
      console.error(err);
    }
  };

  return (
    <ChakraProvider>
      <Container maxW="container.xl" py={10}>
        <VStack spacing={6}>
          <Heading as="h1" size="xl">SEO Analysis Tool</Heading>
          <Box width="100%">
            <Input
              placeholder="Enter URL to analyze"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Box>
          <Button onClick={fetchAndParseContent} colorScheme="blue">
            Analyze
          </Button>
          {error && (
            <Text color="red.500">{error}</Text>
          )}
          {parsedContent && (
            <VStack align="start" spacing={4} width="100%">
              <Text><strong>Title:</strong> {parsedContent.title}</Text>
              <Text><strong>Meta Description:</strong> {parsedContent.metaDescription}</Text>
              <Text><strong>H1 Tags:</strong> {parsedContent.h1Tags.join(', ')}</Text>
              <Text><strong>Links:</strong> {parsedContent.links.length}</Text>
            </VStack>
          )}
        </VStack>
      </Container>
    </ChakraProvider>
  );
}

export default App;
