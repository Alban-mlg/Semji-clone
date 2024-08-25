const express = require('express');
const axios = require('axios');
const cors = require('cors');
const winston = require('winston');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Configure winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'server.log' }),
    new winston.transports.Console()
  ]
});

// Log environment variables
logger.info('Environment variables:', {
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'Not set',
  PORT: process.env.PORT || '3001 (default)',
  NODE_ENV: process.env.NODE_ENV || 'Not set'
});

// Log parsed ALLOWED_ORIGINS
const parsedAllowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
      .map(origin => origin.trim())
      .filter(origin => origin !== '')
  : [];
logger.info('Parsed ALLOWED_ORIGINS:', parsedAllowedOrigins);

// CORS configuration
const allowedOrigins = parsedAllowedOrigins.length > 0 ? parsedAllowedOrigins : ['*'];
logger.info('Allowed origins:', allowedOrigins);
if (allowedOrigins.length === 0) {
  logger.warn('No allowed origins specified. Using wildcard (*) origin.');
  allowedOrigins.push('*');
}
logger.info('Final allowed origins:', allowedOrigins);

// Verify if the new origin is included
if (allowedOrigins.includes('https://tangerine-croquembouche-a869b0.netlify.app')) {
  logger.info('New origin "https://tangerine-croquembouche-a869b0.netlify.app" is included in allowed origins.');
} else {
  logger.warn('New origin "https://tangerine-croquembouche-a869b0.netlify.app" is not included in allowed origins. Please check the ALLOWED_ORIGINS environment variable.');
}

const corsOptions = {
  origin: function (origin, callback) {
    logger.debug('Incoming request origin:', origin);
    if (!origin || allowedOrigins.includes('*')) {
      // Allow requests with no origin (like mobile apps or curl requests)
      // or if wildcard is allowed
      callback(null, true);
    } else if (allowedOrigins.some(allowedOrigin => origin.startsWith(allowedOrigin))) {
      callback(null, true);
    } else {
      logger.warn('Request from non-allowed origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'X-Content-Type-Options'],
  credentials: true,
  optionsSuccessStatus: 204,
  preflightContinue: false,
  maxAge: 86400, // 24 hours
};

// Separate middleware for handling preflight requests
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins.includes('*') ? '*' : origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin, X-Requested-With, Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
  } else {
    res.status(403).end();
  }
});

// Log CORS configuration
logger.info('CORS configuration:', JSON.stringify(corsOptions, null, 2));

// Log the CORS configuration
logger.info('CORS configuration:', JSON.stringify(corsOptions, (key, value) => key === 'origin' ? '[Function: origin]' : value, 2));

// Log the CORS configuration
logger.info('CORS configuration:', JSON.stringify(corsOptions, null, 2));

// Enable CORS for all routes with our custom implementation
app.use((req, res, next) => {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
  } else {
    next();
  }
});

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    headers: req.headers,
    query: req.query,
    body: req.body
  });
  next();
});

// Function to set CORS headers
const setCorsHeaders = (req, res) => {
  const origin = req.headers.origin;

  logger.info('Incoming request details:', {
    method: req.method,
    url: req.url,
    origin: origin,
    headers: req.headers
  });

  // Set Access-Control-Allow-Origin based on the request origin
  if (allowedOrigins.includes('*')) {
    res.header('Access-Control-Allow-Origin', '*');
    logger.info(`Wildcard origin is allowed. Setting Access-Control-Allow-Origin: *`);
  } else if (origin) {
    const matchedOrigin = allowedOrigins.find(allowedOrigin => origin.startsWith(allowedOrigin));
    if (matchedOrigin) {
      res.header('Access-Control-Allow-Origin', origin);
      logger.info(`Origin ${origin} is allowed (matched ${matchedOrigin}). Setting Access-Control-Allow-Origin: ${origin}`);

      // Specific logging for the new Netlify URL
      if (origin === 'https://splendorous-sunflower-ee4031.netlify.app') {
        logger.info('New Netlify URL detected and allowed');
      }
    } else {
      // If no match, use the first allowed origin as a fallback
      res.header('Access-Control-Allow-Origin', allowedOrigins[0]);
      logger.warn(`Non-allowed origin: ${origin}. Setting Access-Control-Allow-Origin to default: ${allowedOrigins[0]}`);
    }
  } else {
    logger.warn('No origin header present in the request');
    res.header('Access-Control-Allow-Origin', allowedOrigins[0]);
  }

  // Ensure other CORS headers are set
  res.header('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
  res.header('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(', '));
  res.header('Access-Control-Allow-Credentials', 'true');

  res.header('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
  res.header('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(', '));
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', String(corsOptions.maxAge));
  res.header('Vary', 'Origin, Access-Control-Request-Headers');

  // Add exposed headers
  res.header('Access-Control-Expose-Headers', corsOptions.exposedHeaders.join(', '));

  const corsHeaders = res.getHeaders();
  logger.info('CORS headers set:', {
    allowOrigin: corsHeaders['access-control-allow-origin'],
    methods: corsHeaders['access-control-allow-methods'],
    headers: corsHeaders['access-control-allow-headers'],
    credentials: corsHeaders['access-control-allow-credentials'],
    maxAge: corsHeaders['access-control-max-age'],
    exposedHeaders: corsHeaders['access-control-expose-headers'],
    vary: corsHeaders['vary']
  });

  // Log all response headers for debugging
  logger.debug('All response headers:', res.getHeaders());

  // Double-check if Access-Control-Allow-Origin is set correctly
  if (!res.getHeader('Access-Control-Allow-Origin')) {
    logger.error('Access-Control-Allow-Origin header is missing');
    res.header('Access-Control-Allow-Origin', allowedOrigins[0]);
    logger.info(`Fallback: Setting Access-Control-Allow-Origin to default: ${allowedOrigins[0]}`);
  }

  // Verify if the set origin matches the request origin
  const setOrigin = res.getHeader('Access-Control-Allow-Origin');
  if (origin && setOrigin !== origin && setOrigin !== '*') {
    logger.warn(`Mismatch between request origin (${origin}) and set origin (${setOrigin})`);
  }

  logger.info('Final CORS configuration:', {
    allowedOrigins,
    corsOptions,
    setOrigin: setOrigin,
    requestOrigin: origin,
    originMatchingResult: origin ? (setOrigin === origin ? 'Exact match' : (setOrigin === '*' ? 'Wildcard match' : 'No match')) : 'No origin in request'
  });

  // Additional logging for debugging
  logger.debug('Detailed origin matching process:', {
    requestOrigin: origin,
    allowedOrigins: allowedOrigins,
    matchResult: allowedOrigins.includes('*') ? 'Wildcard match' :
                 (origin ? (allowedOrigins.find(allowedOrigin => origin.startsWith(allowedOrigin)) ? 'Matched origin' : 'No match') : 'No origin in request'),
    finalSetOrigin: setOrigin,
    isNewNetlifyUrl: origin === 'https://splendorous-sunflower-ee4031.netlify.app'
  });
};

// Wrapper for consistent error handling with CORS headers
const handleErrorWithCors = (req, res, error) => {
  logger.error('Error:', { error: error.message, stack: error.stack });

  let statusCode = error.status || 500;
  let errorMessage = error.message || 'Internal server error';

  if (axios.isAxiosError(error)) {
    if (error.response) {
      statusCode = error.response.status;
      errorMessage = `Proxy target responded with status ${statusCode}: ${error.response.statusText}`;
    } else if (error.request) {
      errorMessage = 'No response received from the target server';
    }
  }

  if (!res.headersSent) {
    setCorsHeaders(req, res);
    res.status(statusCode).json({ error: errorMessage });
  } else {
    logger.warn('Headers already sent, unable to set CORS headers or send error response');
    // If headers are already sent, we can't modify them, so we'll end the response
    res.end();
  }
};

// Middleware to ensure CORS headers are set for all responses
app.use((req, res, next) => {
  // Set CORS headers immediately after receiving the request
  setCorsHeaders(req, res);

  // Override res.json and res.send to ensure CORS headers are set
  const originalJson = res.json;
  res.json = function(body) {
    setCorsHeaders(req, res);
    return originalJson.call(this, body);
  };

  const originalSend = res.send;
  res.send = function(body) {
    setCorsHeaders(req, res);
    return originalSend.call(this, body);
  };

  // Ensure CORS headers are set even if the response is sent in an unexpected way
  res.on('finish', () => {
    setCorsHeaders(req, res);
  });

  next();
});

app.get('/proxy', async (req, res, next) => {
  let statusCode = 200;
  let responseData = null;
  let contentType = 'application/json';

  try {
    logger.info('Incoming proxy request details', {
      origin: req.headers.origin,
      method: req.method,
      url: req.url,
      headers: req.headers,
      query: req.query
    });

    // Log CORS-specific information for incoming request
    logger.info('CORS details for incoming request:', {
      allowedOrigins,
      requestOrigin: req.headers.origin,
      isOriginAllowed: allowedOrigins.includes(req.headers.origin) || allowedOrigins.includes('*')
    });

    // Specific logging for the new Netlify URL
    if (req.headers.origin === 'https://splendorous-sunflower-ee4031.netlify.app') {
      logger.info('Request from new Netlify deployment URL detected');
    }

    const { url } = req.query;

    if (!url) {
      throw new Error('URL parameter is required');
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      throw new Error('Invalid URL provided');
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('Only HTTP and HTTPS protocols are supported');
    }

    logger.info(`Proxying request for URL: ${parsedUrl.href}`);

    const https = require('https');
    const response = await axios.get(parsedUrl.href, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: null,
      responseType: 'arraybuffer',
      withCredentials: true,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
        secureOptions: require('constants').SSL_OP_NO_TLSv1 | require('constants').SSL_OP_NO_TLSv1_1
      })
    }).catch(error => {
      logger.error('Axios request failed:', {
        message: error.message,
        code: error.code,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
          timeout: error.config?.timeout
        }
      });

      if (axios.isAxiosError(error)) {
        if (error.response) {
          logger.error('Target server response:', {
            status: error.response.status,
            statusText: error.response.statusText,
            headers: error.response.headers,
            data: error.response.data.toString('utf8').substring(0, 500) // Log first 500 chars of response data
          });
        } else if (error.request) {
          logger.error('No response received from target server:', {
            method: error.config?.method,
            url: error.config?.url,
            timeout: error.config?.timeout,
            errorCode: error.code
          });
        } else {
          logger.error('Error setting up the request:', error.message);
        }
      } else {
        logger.error('Non-Axios error:', error);
      }
      throw error;
    });

    logger.info('Proxy request successful', {
      status: response.status,
      url: url,
      headers: response.headers,
      contentLength: response.data.length
    });

    statusCode = response.status;
    responseData = response.data;
    contentType = response.headers['content-type'] || 'text/html; charset=utf-8';

  } catch (error) {
    logger.error('Error in proxy request', {
      error: error.message,
      stack: error.stack,
      url: req.query.url
    });

    statusCode = 500;
    let errorMessage = 'Internal server error';

    if (error instanceof Error) {
      errorMessage = error.message;
      if (error.message.includes('Invalid URL') || error.message.includes('URL parameter is required')) {
        statusCode = 400;
      }
    }

    if (axios.isAxiosError(error)) {
      if (error.response) {
        statusCode = error.response.status;
        errorMessage = `Proxy target responded with status ${statusCode}: ${error.response.statusText}`;
        logger.error('Target server error response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          headers: error.response.headers,
          data: error.response.data.toString('utf8').substring(0, 500) // Log first 500 chars of error response data
        });
      } else if (error.request) {
        statusCode = 504;
        errorMessage = 'Gateway Timeout: No response received from the target server';
        logger.error('No response from target server:', {
          request: {
            method: error.config?.method,
            url: error.config?.url,
            headers: error.config?.headers,
            timeout: error.config?.timeout
          }
        });
      }
    }

    responseData = { error: errorMessage };
  }

  if (!res.headersSent) {
    // Set Content-Type header
    res.setHeader('Content-Type', contentType);

    // Ensure CORS headers are set before sending the response
    setCorsHeaders(req, res);

    // Log all headers before sending the response
    const allHeaders = res.getHeaders();
    logger.info('All headers before sending response:', allHeaders);

    // Send the response
    res.status(statusCode).send(responseData);

    // Log the final response headers and status after sending
    logger.info('Response sent', {
      headers: res.getHeaders(),
      status: res.statusCode,
      contentLength: responseData.length || (responseData.error && responseData.error.length) || 0
    });

    // Log CORS-related response headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': res.getHeader('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': res.getHeader('Access-Control-Allow-Headers'),
      'Access-Control-Allow-Credentials': res.getHeader('Access-Control-Allow-Credentials')
    };
    logger.info('CORS-related response headers:', corsHeaders);

    // Check and log if any CORS headers are missing
    const missingHeaders = Object.entries(corsHeaders)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingHeaders.length > 0) {
      logger.warn('Missing CORS headers in the response:', missingHeaders);
    }

    // Log specific CORS-related information
    logger.info('CORS-specific details:', {
      allowedOrigins,
      requestOrigin: req.headers.origin,
      responseAllowOrigin: res.getHeader('Access-Control-Allow-Origin'),
      isOriginAllowed: allowedOrigins.includes(req.headers.origin) || allowedOrigins.includes('*')
    });

    // Additional CORS debugging information
    logger.debug('CORS debugging:', {
      allowedOrigins,
      requestOrigin: req.headers.origin,
      responseAllowOrigin: res.getHeader('Access-Control-Allow-Origin'),
      originMatchingResult: allowedOrigins.includes(req.headers.origin) ? 'Exact match' :
                            (allowedOrigins.includes('*') ? 'Wildcard match' : 'No match'),
      corsHeadersSet: Object.keys(corsHeaders).filter(key => corsHeaders[key] !== undefined)
    });

    // Specific logging for the new Netlify URL
    if (req.headers.origin === 'https://splendorous-sunflower-ee4031.netlify.app') {
      logger.info('Response sent to new Netlify deployment URL', {
        corsHeaders,
        allowedOrigins,
        responseAllowOrigin: res.getHeader('Access-Control-Allow-Origin'),
        requestOrigin: req.headers.origin,
        isOriginAllowed: allowedOrigins.includes(req.headers.origin) || allowedOrigins.includes('*'),
        allResponseHeaders: res.getHeaders()
      });
    }
  } else {
    logger.warn('Headers already sent, unable to set headers or send response');
  }
});

// Catch-all error handler
app.use((err, req, res, next) => {
  logger.error('Catch-all error handler:', { error: err.message, stack: err.stack });
  setCorsHeaders(req, res);
  handleErrorWithCors(req, res, err);
});

// OPTIONS request handler for CORS preflight
app.options('*', (req, res) => {
  logger.info('Handling OPTIONS request', {
    origin: req.headers.origin,
    method: req.method,
    url: req.url
  });
  setCorsHeaders(req, res);
  // Additional headers specific to preflight requests
  res.header('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
  res.header('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(', '));
  res.header('Access-Control-Max-Age', String(corsOptions.maxAge));

  // Ensure Vary header is set
  res.header('Vary', 'Origin');

  // Log the headers set for the OPTIONS request
  logger.info('OPTIONS response headers:', res.getHeaders());

  // Log specific CORS-related information
  logger.info('CORS-specific details for OPTIONS:', {
    allowedOrigins,
    requestOrigin: req.headers.origin,
    responseAllowOrigin: res.getHeader('Access-Control-Allow-Origin'),
    isOriginAllowed: allowedOrigins.includes(req.headers.origin) || allowedOrigins.includes('*')
  });

  res.sendStatus(204);
});

app.listen(port, '0.0.0.0', () => {
  logger.info(`Proxy server running on 0.0.0.0:${port}`);
  logger.info(`CORS enabled for allowed origins: ${allowedOrigins.join(', ')}`);
  logger.info('Environment variables:');
  logger.info(`  ALLOWED_ORIGINS: ${process.env.ALLOWED_ORIGINS}`);
  logger.info(`  PORT: ${process.env.PORT || '3001 (default)'}`);
  logger.info('CORS configuration:', JSON.stringify(corsOptions, null, 2));
});
