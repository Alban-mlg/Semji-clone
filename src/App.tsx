import React, { useState } from 'react';
import axios from 'axios';
import * as cheerio from 'cheerio';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import {
  ChakraProvider,
  Box,
  VStack,
  HStack,
  Input,
  Button,
  Text,
  Heading,
  Container,
  Textarea,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Flex,
  UnorderedList,
  ListItem,
} from '@chakra-ui/react';

declare module 'react-quill';

interface ParsedContent {
  title: string;
  metaDescription: string;
  h1Tags: string[];
  links: string[];
  content: string;
}

function App() {
  const [url, setUrl] = useState('');
  const [parsedContent, setParsedContent] = useState<ParsedContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seoSuggestions, setSeoSuggestions] = useState<string[]>([]);

  const fetchAndParseContent = async () => {
    try {
      console.log('Starting fetchAndParseContent...');
      setError(null);
      setParsedContent(null);
      const proxyUrl = process.env.REACT_APP_PROXY_URL || 'https://tourmaline-begonia-fe69b6.netlify.app/proxy';
      console.log('Using proxy URL:', proxyUrl);
      console.log('Fetching content from:', url);

      if (!url.trim()) {
        throw new Error('Please enter a URL');
      }

      let parsedUrl;
      try {
        parsedUrl = new URL(url);
        console.log('Parsed URL:', parsedUrl.href);
      } catch (urlError) {
        console.error('URL parsing error:', urlError);
        throw new Error('Invalid URL format. Please enter a valid URL including the protocol (http:// or https://)');
      }

      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error('Only HTTP and HTTPS protocols are supported');
      }

      console.log('Sending request to proxy server...');
      const response = await axios.get(`${proxyUrl}?url=${encodeURIComponent(parsedUrl.href)}`, {
        timeout: 15000, // 15 seconds timeout
        validateStatus: () => true, // Allow all status codes to be resolved
        withCredentials: false, // Ensure credentials are not sent
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });

      console.log('Response received:', response.status, response.statusText);
      console.log('Response headers:', response.headers);
      console.log('Response data type:', typeof response.data);
      console.log('Response data length:', typeof response.data === 'string' ? response.data.length : 'N/A');

      if (response.status >= 400) {
        throw new Error(`Proxy server responded with status ${response.status}: ${response.statusText}`);
      }

      const html = response.data;
      if (typeof html !== 'string' || html.trim().length === 0) {
        throw new Error('Received empty or invalid HTML from the proxy server');
      }

      console.log('Parsing HTML content...');
      const $ = cheerio.load(html);

      const parsedData: ParsedContent = {
        title: $('title').text().trim(),
        metaDescription: $('meta[name="description"]').attr('content')?.trim() || '',
        h1Tags: $('h1').map((_, el) => $(el).text().trim()).get(),
        links: $('a').map((_, el) => $(el).attr('href')).get().filter(Boolean),
        content: $('body').text().trim(),
      };

      console.log('Parsed data:', JSON.stringify(parsedData, null, 2));
      setParsedContent(parsedData);
      console.log('Content parsed successfully and state updated');
      generateSeoSuggestions(parsedData);
    } catch (err) {
      console.error('Error details:', err);
      let errorMessage = 'An unexpected error occurred. Please try again and if the issue persists, contact support.';

      if (axios.isAxiosError(err)) {
        if (err.response) {
          errorMessage = `Server responded with status ${err.response.status}: ${err.response.statusText}`;
          console.error('Response data:', err.response.data);
          console.error('Response headers:', err.response.headers);
          if (err.response.status === 0 || err.response.status === 403) {
            errorMessage += ' This may be due to CORS restrictions. Please ensure the target website allows cross-origin requests.';
          }
        } else if (err.request) {
          errorMessage = 'Network error: No response received. Please check your internet connection and try again.';
          console.error('Request details:', err.request);
          if (err.code === 'ECONNABORTED') {
            errorMessage = 'Request timed out. The server took too long to respond.';
          }
        } else {
          errorMessage = `Error setting up the request: ${err.message}`;
        }
        console.error('Axios error config:', err.config);
      } else if (err instanceof Error) {
        errorMessage = err.message;
        if (err.message.toLowerCase().includes('cors')) {
          errorMessage += ' This appears to be a CORS-related issue. The target website may not allow cross-origin requests.';
        }
      } else {
        console.error('Unexpected error type:', typeof err);
        console.error('Error value:', err);
      }

      setError(errorMessage);
      console.error('Unhandled error in fetchAndParseContent:', err);
    } finally {
      console.log('fetchAndParseContent operation completed');
    }
  };

  const generateSeoSuggestions = (parsedData: ParsedContent) => {
    const suggestions: { title: string; description: string }[] = [];

    // Title suggestions
    if (parsedData.title.length < 30 || parsedData.title.length > 60) {
      suggestions.push({
        title: 'Optimize title length',
        description: 'Aim for a title length between 30-60 characters. Current length: ' + parsedData.title.length
      });
    }

    // Meta description suggestions
    if (parsedData.metaDescription.length < 120 || parsedData.metaDescription.length > 160) {
      suggestions.push({
        title: 'Optimize meta description length',
        description: 'Aim for a meta description length between 120-160 characters. Current length: ' + parsedData.metaDescription.length
      });
    }

    // H1 tag suggestions
    if (parsedData.h1Tags.length === 0) {
      suggestions.push({
        title: 'Add an H1 tag',
        description: 'Every page should have a unique H1 tag that accurately describes the page content.'
      });
    } else if (parsedData.h1Tags.length > 1) {
      suggestions.push({
        title: 'Use only one H1 tag per page',
        description: 'Multiple H1 tags can confuse search engines. Use only one H1 tag that describes your main topic.'
      });
    }

    // Link suggestions
    if (parsedData.links.length < 2) {
      suggestions.push({
        title: 'Add more internal or external links',
        description: 'Including relevant links helps search engines understand your content and improves user experience.'
      });
    }

    // Keyword in title
    if (!parsedData.title.toLowerCase().includes(parsedData.content.toLowerCase().substring(0, 20))) {
      suggestions.push({
        title: 'Include main keyword in title',
        description: 'Ensure your main keyword or topic is present in the page title for better SEO.'
      });
    }

    // Content length suggestion
    if (parsedData.content.length < 300) {
      suggestions.push({
        title: 'Increase content length',
        description: 'Pages with more content tend to rank better. Aim for at least 300 words of unique, valuable content.'
      });
    }

    // Image alt text check (assuming we add an images field to ParsedContent in the future)
    // if (parsedData.images && parsedData.images.some(img => !img.alt)) {
    //   suggestions.push({
    //     title: 'Add alt text to all images',
    //     description: 'Alt text helps search engines understand image content and improves accessibility.'
    //   });
    // }

    setSeoSuggestions(suggestions);
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
          <Button
            onClick={fetchAndParseContent}
            colorScheme="blue"
            isLoading={!parsedContent && !error}
          >
            Analyze
          </Button>
          {error && (
            <Text color="red.500">{error}</Text>
          )}
          {parsedContent ? (
            <Flex width="100%" gap={6} direction={["column", "row"]} minHeight="60vh">
              <Box flex={1} display="flex" flexDirection="column">
                <Heading as="h2" size="md" mb={4}>Page Content</Heading>
                <Box flexGrow={1} minHeight="50vh">
                  <ReactQuill
                    value={parsedContent.content}
                    onChange={(content) => setParsedContent({...parsedContent, content})}
                    modules={{
                      toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{'list': 'ordered'}, {'list': 'bullet'}],
                        ['link', 'image'],
                        ['clean']
                      ],
                    }}
                    style={{ height: '100%' }}
                  />
                </Box>
              </Box>
              <Box flex={1}>
                <Heading as="h2" size="md" mb={4}>SEO Analysis</Heading>
                <VStack align="start" spacing={4} overflowY="auto" maxHeight="50vh">
                  <Text><strong>Title:</strong> {parsedContent.title || 'N/A'}</Text>
                  <Text><strong>Meta Description:</strong> {parsedContent.metaDescription || 'N/A'}</Text>
                  <Text><strong>H1 Tags:</strong> {parsedContent.h1Tags.length > 0 ? parsedContent.h1Tags.join(', ') : 'None'}</Text>
                  <Text><strong>Links:</strong> {parsedContent.links.length}</Text>
                </VStack>
              </Box>
            </Flex>
          ) : (
            <Text>Enter a URL and click Analyze to see the SEO analysis.</Text>
          )}
          {seoSuggestions.length > 0 && (
            <Box width="100%" mt={6}>
              <Heading as="h2" size="md" mb={4}>SEO Suggestions</Heading>
              <Accordion allowMultiple>
                {seoSuggestions.map((suggestion, index) => (
                  <AccordionItem key={index}>
                    <h2>
                      <AccordionButton>
                        <Box flex="1" textAlign="left">
                          <Text fontWeight="bold">{suggestion.title}</Text>
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                    </h2>
                    <AccordionPanel pb={4}>
                      <Text mb={2}>{suggestion.description}</Text>
                      <UnorderedList>
                        {suggestion.tips.map((tip, tipIndex) => (
                          <ListItem key={tipIndex}>{tip}</ListItem>
                        ))}
                      </UnorderedList>
                    </AccordionPanel>
                  </AccordionItem>
                ))}
              </Accordion>
            </Box>
          )}
        </VStack>
      </Container>
    </ChakraProvider>
  );
}

export default App;
