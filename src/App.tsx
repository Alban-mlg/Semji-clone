import React, { useState } from 'react';
import axios from 'axios';
import * as cheerio from 'cheerio';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import DOMPurify from 'dompurify';
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
  Progress,
  Checkbox,
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
  const [keyword, setKeyword] = useState('');
  const [parsedContent, setParsedContent] = useState<ParsedContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seoSuggestions, setSeoSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [completedSuggestions, setCompletedSuggestions] = useState(0);
  const [serpResults, setSerpResults] = useState<any>(null);

  const generateSeoSuggestions = React.useCallback((parsedData: ParsedContent, keyword: string) => {
    const suggestions: { title: string; description: string }[] = [];

    // Title suggestions
    if (parsedData.title.length < 30 || parsedData.title.length > 60) {
      suggestions.push({
        title: 'Optimize title length',
        description: `Aim for a title length between 30-60 characters. Current length: ${parsedData.title.length}`
      });
    }

    // Keyword in title
    if (keyword && !parsedData.title.toLowerCase().includes(keyword.toLowerCase())) {
      suggestions.push({
        title: 'Include focus keyword in title',
        description: `Ensure your focus keyword "${keyword}" is present in the page title for better SEO.`
      });
    }

    // Meta description suggestions
    if (parsedData.metaDescription.length < 120 || parsedData.metaDescription.length > 160) {
      suggestions.push({
        title: 'Optimize meta description length',
        description: `Aim for a meta description length between 120-160 characters. Current length: ${parsedData.metaDescription.length}`
      });
    }

    // Keyword in meta description
    if (keyword && !parsedData.metaDescription.toLowerCase().includes(keyword.toLowerCase())) {
      suggestions.push({
        title: 'Include focus keyword in meta description',
        description: `Include your focus keyword "${keyword}" in the meta description to improve relevance.`
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
    } else if (keyword && !parsedData.h1Tags[0].toLowerCase().includes(keyword.toLowerCase())) {
      suggestions.push({
        title: 'Include focus keyword in H1 tag',
        description: `Include your focus keyword "${keyword}" in the H1 tag to emphasize the main topic.`
      });
    }

    // Link suggestions
    if (parsedData.links.length < 2) {
      suggestions.push({
        title: 'Add more internal or external links',
        description: 'Including relevant links helps search engines understand your content and improves user experience.'
      });
    }

    // Content length suggestion
    if (parsedData.content.length < 300) {
      suggestions.push({
        title: 'Increase content length',
        description: 'Pages with more content tend to rank better. Aim for at least 300 words of unique, valuable content.'
      });
    }

    // Keyword density
    const keywordRegex = new RegExp(keyword, 'gi');
    const keywordCount = (parsedData.content.match(keywordRegex) || []).length;
    const wordCount = parsedData.content.split(/\s+/).length;
    const keywordDensity = (keywordCount / wordCount) * 100;

    if (keywordDensity < 0.5) {
      suggestions.push({
        title: 'Increase keyword density',
        description: `Your focus keyword "${keyword}" appears ${keywordCount} times (${keywordDensity.toFixed(2)}%). Aim for a keyword density between 0.5% and 2.5%.`
      });
    } else if (keywordDensity > 2.5) {
      suggestions.push({
        title: 'Decrease keyword density',
        description: `Your focus keyword "${keyword}" appears ${keywordCount} times (${keywordDensity.toFixed(2)}%). This might be considered keyword stuffing. Aim for a keyword density between 0.5% and 2.5%.`
      });
    }

    // Map suggestions to an array of strings
    const formattedSuggestions = suggestions.map(suggestion => `${suggestion.title}: ${suggestion.description}`);

    setSeoSuggestions(formattedSuggestions);
  }, []);

const performSerpAnalysis = React.useCallback(async (keyword: string) => {
  try {
    // Simulating SERP analysis with mock data
    // In a real-world scenario, this would involve calling a SERP API
    const mockSerpResults = {
      topKeywords: [keyword, `${keyword} best`, `${keyword} review`, `${keyword} price`],
      avgTitleLength: 55,
      avgDescriptionLength: 140,
      commonTitleElements: ['Best', 'Top', 'Review', '2023'],
    };

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    setSerpResults(mockSerpResults);
  } catch (error) {
    console.error('Error performing SERP analysis:', error);
    setError('Failed to perform SERP analysis. Please try again.');
  }
}, []);

const fetchAndParseContent = React.useCallback(async () => {
  console.log('Starting fetchAndParseContent...');
  try {
    console.log('Setting isLoading to true');
    setIsLoading(true);
    setError(null);
    setParsedContent(null);
    setSerpResults(null);

    const proxyUrl = process.env.REACT_APP_PROXY_URL || 'https://tourmaline-begonia-fe69b6.netlify.app/proxy';
    console.log('Using proxy URL:', proxyUrl);
    console.log('Fetching content from:', url);

    if (!url.trim()) {
      throw new Error('Please enter a URL');
    }

    if (!keyword.trim()) {
      throw new Error('Please enter a keyword for analysis');
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
      timeout: 30000,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      withCredentials: true,
    }).catch(error => {
      console.error('Axios request failed:', error.message);
      if (axios.isAxiosError(error)) {
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
        } else if (error.request) {
          console.error('No response received:', error.request);
        } else {
          console.error('Error setting up the request:', error.message);
        }
      } else {
        console.error('Non-Axios error:', error);
      }
      throw error;
    });

    console.log('Response received:', response.status, response.statusText);

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
      content: DOMPurify.sanitize($('body').html() || '', { ALLOWED_TAGS: [] }).trim(),
    };

    console.log('Content parsed successfully');
    console.log('Setting parsedContent');
    setParsedContent(parsedData);
    console.log('Generating SEO suggestions');
    generateSeoSuggestions(parsedData, keyword);
    console.log('SEO suggestions generated');

    // Perform SERP analysis in the background
    performSerpAnalysis(keyword);

  } catch (err) {
    console.error('Error details:', err);
    let errorMessage = 'An unexpected error occurred. Please try again and if the issue persists, contact support.';

    if (axios.isAxiosError(err)) {
      if (err.response) {
        errorMessage = `Server responded with status ${err.response.status}: ${err.response.statusText}`;
        if (err.response.status === 0 || err.response.status === 403) {
          errorMessage += ' This may be due to CORS restrictions. Please ensure the target website allows cross-origin requests.';
        }
      } else if (err.request) {
        errorMessage = 'Network error: No response received. Please check your internet connection and try again.';
        if (err.code === 'ECONNABORTED') {
          errorMessage = 'Request timed out. The server took too long to respond.';
        }
      } else {
        errorMessage = `Error setting up the request: ${err.message}`;
      }
    } else if (err instanceof Error) {
      errorMessage = err.message;
      if (err.message.toLowerCase().includes('cors')) {
        errorMessage += ' This appears to be a CORS-related issue. The target website may not allow cross-origin requests.';
      }
    }

    console.log('Setting error:', errorMessage);
    setError(errorMessage);
  } finally {
    console.log('Setting isLoading to false');
    setIsLoading(false);
    console.log('fetchAndParseContent operation completed');
  }
}, [url, keyword, generateSeoSuggestions, performSerpAnalysis]);

// This function has been moved above fetchAndParseContent

const handleSuggestionCompletion = React.useCallback((isChecked: boolean, index: number) => {
  setCompletedSuggestions(prev => isChecked ? Math.max(prev, index + 1) : index);
}, []);

  return (
    <ChakraProvider>
      <Container maxW="container.xl" py={10}>
        <VStack spacing={6}>
          <Heading as="h1" size="xl">SEO Analysis Tool</Heading>
          <Box width="100%">
            <Input
              placeholder="Enter focus keyword"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              mb={2}
            />
            <Input
              placeholder="Enter URL to analyze"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Box>
          <Button
            onClick={React.useCallback(() => {
              console.log('Analyze button clicked. Current isLoading state:', isLoading);
              console.log('URL to analyze:', url);
              console.log('Focus keyword:', keyword);
              fetchAndParseContent();
            }, [isLoading, fetchAndParseContent, url, keyword])}
            colorScheme="blue"
            isLoading={isLoading}
            isDisabled={isLoading || !keyword.trim()}
          >
            Analyze
          </Button>
          {error && (
            <Text color="red.500">{error}</Text>
          )}
          {parsedContent ? (
            <Flex width="100%" gap={6} direction={["column", "row"]} minHeight="70vh">
              <Box flex={1} maxWidth="40%" overflowY="auto">
                <Heading as="h2" size="md" mb={4}>Page Content</Heading>
                <Box minHeight="60vh">
                  <Text whiteSpace="pre-wrap">{parsedContent.content}</Text>
                </Box>
              </Box>
              <Box flex={2}>
                <Heading as="h2" size="md" mb={4}>SEO Analysis</Heading>
                <VStack align="start" spacing={4} overflowY="auto" maxHeight="60vh">
                  <Text><strong>Focus Keyword:</strong> {keyword}</Text>
                  <Text><strong>Title:</strong> {parsedContent.title || 'N/A'}</Text>
                  <Text><strong>Meta Description:</strong> {parsedContent.metaDescription || 'N/A'}</Text>
                  <Text><strong>H1 Tags:</strong> {parsedContent.h1Tags.length > 0 ? parsedContent.h1Tags.join(', ') : 'None'}</Text>
                  <Text><strong>Links:</strong> {parsedContent.links.length}</Text>
                </VStack>
                {seoSuggestions.length > 0 && (
                  <Box width="100%" mt={6}>
                    <Heading as="h3" size="md" mb={4}>SEO Suggestions</Heading>
                    <Progress value={(completedSuggestions / seoSuggestions.length) * 100} size="sm" colorScheme="blue" mb={4} />
                    <Accordion allowMultiple>
                      {seoSuggestions.map((suggestion, index) => {
                        const [title, description] = suggestion.split(': ');
                        return (
                          <AccordionItem key={index}>
                            <h2>
                              <AccordionButton>
                                <Box flex="1" textAlign="left">
                                  <Text fontWeight="bold">{title}</Text>
                                </Box>
                                <AccordionIcon />
                              </AccordionButton>
                            </h2>
                            <AccordionPanel pb={4}>
                              <Text mb={2}>{description}</Text>
                              <Checkbox
                                isChecked={completedSuggestions > index}
                                onChange={(e) => handleSuggestionCompletion(e.target.checked, index)}
                              >
                                Mark as completed
                              </Checkbox>
                            </AccordionPanel>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </Box>
                )}
                {serpResults && (
                  <Box width="100%" mt={6}>
                    <Heading as="h3" size="md" mb={4}>SERP Analysis</Heading>
                    <VStack align="start" spacing={4}>
                      <Text><strong>Top Ranking Keywords:</strong> {serpResults.topKeywords.join(', ')}</Text>
                      <Text><strong>Average Title Length:</strong> {serpResults.avgTitleLength} characters</Text>
                      <Text><strong>Average Description Length:</strong> {serpResults.avgDescriptionLength} characters</Text>
                      <Text><strong>Common Title Elements:</strong> {serpResults.commonTitleElements.join(', ')}</Text>
                    </VStack>
                  </Box>
                )}
              </Box>
            </Flex>
          ) : (
            <Text>Enter a URL and focus keyword, then click Analyze to see the SEO analysis.</Text>
          )}
        </VStack>
      </Container>
    </ChakraProvider>
  );
}

export default App;
