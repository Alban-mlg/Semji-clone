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
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
      .map(origin => origin.trim())
      .filter(origin => origin !== '')
  : [];
const useWildcard = allowedOrigins.includes('*');
logger.info('Parsed ALLOWED_ORIGINS:', allowedOrigins);
logger.info('Using wildcard for CORS:', useWildcard);

// CORS configuration
logger.info('Allowed origins:', allowedOrigins);
if (allowedOrigins.length === 0) {
  logger.warn('No allowed origins specified. CORS will block all requests.');
} else {
  logger.info('CORS will be restricted to the specified origins.');
}
logger.info('Final allowed origins:', allowedOrigins);

// Verify if Netlify origins are included
const netlifyOrigins = allowedOrigins.filter(origin => origin.includes('.netlify.app'));
if (netlifyOrigins.length > 0) {
  logger.info('Netlify origins included in allowed origins:', netlifyOrigins);
} else {
  logger.warn('No Netlify origins found in allowed origins. Please check the ALLOWED_ORIGINS environment variable.');
}

const corsOptions = {
  origin: function (origin, callback) {
    logger.debug('Incoming request origin:', origin);
    if (!origin || allowedOrigins.includes('*')) {
      callback(null, true);
    } else if (allowedOrigins.some(allowedOrigin => origin.startsWith(allowedOrigin))) {
      callback(null, true);
    } else {
      logger.warn('Request from non-allowed origin:', origin);
      callback(new Error('Origin not allowed by CORS policy'));
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
  if (allowedOrigins.some(allowedOrigin => origin.startsWith(allowedOrigin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin, X-Requested-With, Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
  } else {
    logger.warn(`Preflight request from non-allowed origin: ${origin}`);
    res.status(403).end();
  }
});

// Log CORS configuration
logger.info('CORS configuration:', JSON.stringify(corsOptions, (key, value) => key === 'origin' ? '[Function: origin]' : value, 2));

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
    res.header('Access-Control-Allow-Origin', origin || '*');
    logger.info(`Wildcard origin allowed. Setting Access-Control-Allow-Origin: ${origin || '*'}`);
  } else if (origin && allowedOrigins.some(allowedOrigin => origin.startsWith(allowedOrigin))) {
    res.header('Access-Control-Allow-Origin', origin);
    logger.info(`Origin ${origin} is allowed. Setting Access-Control-Allow-Origin: ${origin}`);
  } else {
    logger.warn(`Non-allowed origin: ${origin}. CORS will block this request.`);
    // Don't set Access-Control-Allow-Origin for non-allowed origins
  }

  // Ensure other CORS headers are set
  res.header('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
  res.header('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(', '));
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', String(corsOptions.maxAge));
  res.header('Vary', 'Origin');

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

  // Verify if Access-Control-Allow-Origin is set correctly
  const setOrigin = res.getHeader('Access-Control-Allow-Origin');
  if (origin && setOrigin !== origin && setOrigin !== '*') {
    logger.warn(`Mismatch between request origin (${origin}) and set origin (${setOrigin})`);
  }

  logger.info('Final CORS configuration:', {
    allowedOrigins,
    corsOptions,
    setOrigin: setOrigin,
    requestOrigin: origin,
    originMatchingResult: origin ? (setOrigin === origin || setOrigin === '*' ? 'Match' : 'No match') : 'No origin in request'
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

app.get('/proxy', async (req, res, next) => {
  const { url } = req.query;

  if (!url) {
    return handleErrorWithCors(req, res, new Error('URL parameter is required'));
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('Only HTTP and HTTPS protocols are supported');
    }
  } catch (error) {
    return handleErrorWithCors(req, res, new Error('Invalid URL provided'));
  }

  logger.info('Incoming proxy request details', {
    origin: req.headers.origin,
    method: req.method,
    url: req.url,
    targetUrl: parsedUrl.href,
    headers: req.headers,
    query: req.query,
    isOriginAllowed: allowedOrigins.some(allowedOrigin => req.headers.origin?.startsWith(allowedOrigin))
  });

  try {
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
    });

    logger.info('Proxy request successful', {
      status: response.status,
      url: url,
      headers: response.headers,
      contentLength: response.data.length
    });

    if (!res.headersSent) {
      setCorsHeaders(req, res);
      res.setHeader('Content-Type', response.headers['content-type'] || 'text/html; charset=utf-8');
      res.status(response.status).send(response.data);

      logger.info('Response sent', {
        headers: res.getHeaders(),
        status: res.statusCode,
        contentLength: response.data.length,
        corsHeaders: {
          'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
          'Access-Control-Allow-Methods': res.getHeader('Access-Control-Allow-Methods'),
          'Access-Control-Allow-Headers': res.getHeader('Access-Control-Allow-Headers'),
          'Access-Control-Allow-Credentials': res.getHeader('Access-Control-Allow-Credentials'),
        }
      });
    }
  } catch (error) {
    logger.error('Proxy request failed', {
      error: error.message,
      stack: error.stack,
      url: parsedUrl.href,
      origin: req.headers.origin
    });
    handleErrorWithCors(req, res, error);
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
    isOriginAllowed: allowedOrigins.some(allowedOrigin => req.headers.origin?.startsWith(allowedOrigin)) || allowedOrigins.includes('*')
  });

  res.sendStatus(204);
});

app.listen(port, '0.0.0.0', () => {
  logger.info(`Proxy server running on 0.0.0.0:${port}`);
  logger.info(`CORS enabled for allowed origins: ${allowedOrigins.join(', ')}`);
  logger.info('Environment variables:');
  logger.info(`  ALLOWED_ORIGINS: ${process.env.ALLOWED_ORIGINS}`);
  logger.info(`  PORT: ${process.env.PORT || '3001 (default)'}`);
  logger.info('CORS configuration:', JSON.stringify(corsOptions, (key, value) => key === 'origin' ? '[Function: origin]' : value, 2));
});
