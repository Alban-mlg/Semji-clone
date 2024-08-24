const express = require('express');
const axios = require('axios');
const cors = require('cors');
const winston = require('winston');

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

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'https://gilded-peony-d724d9.netlify.app',
      'https://shimmering-griffin-7ec005.netlify.app',
      'http://localhost:3000',
      'https://friendly-seahorse-2706ff.netlify.app'
    ];
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'X-Content-Type-Options'],
  credentials: true,
  optionsSuccessStatus: 204,
  preflightContinue: false,
  maxAge: 86400 // 24 hours
};

// Log the CORS configuration
logger.info('CORS configuration:', JSON.stringify(corsOptions, (key, value) => key === 'origin' ? '[Function: origin]' : value, 2));

// Log the CORS configuration
logger.info('CORS configuration:', JSON.stringify(corsOptions, null, 2));

// Enable CORS for all routes with specific options
app.use(cors(corsOptions));

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
  // Set Access-Control-Allow-Origin header to '*' for simplicity
  res.header('Access-Control-Allow-Origin', '*');

  res.header('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
  res.header('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(', '));
  res.header('Access-Control-Allow-Credentials', String(corsOptions.credentials));
  res.header('Access-Control-Max-Age', String(corsOptions.maxAge));
  res.header('Vary', 'Origin');

  const corsHeaders = res.getHeaders();
  logger.info('CORS headers set:', {
    allowOrigin: corsHeaders['access-control-allow-origin'] || 'Not set',
    methods: corsHeaders['access-control-allow-methods'],
    headers: corsHeaders['access-control-allow-headers'],
    credentials: corsHeaders['access-control-allow-credentials'],
    maxAge: corsHeaders['access-control-max-age']
  });

  // Log all response headers for debugging
  logger.debug('All response headers:', res.getHeaders());

  // Check if Access-Control-Allow-Origin is set correctly
  if (!res.getHeader('Access-Control-Allow-Origin')) {
    logger.warn('Access-Control-Allow-Origin header is missing');
  }
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
    logger.info('Incoming request details', {
      origin: req.headers.origin,
      headers: req.headers,
      query: req.query
    });

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

    logger.info(`Received request for URL: ${parsedUrl.href}`);

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

    // Log CORS headers before sending the response
    const corsHeaders = res.getHeaders();
    logger.info('CORS headers before sending response:', corsHeaders);

    // Send the response
    res.status(statusCode).send(responseData);

    // Log the final response headers and status after sending
    logger.info('Response sent', {
      headers: res.getHeaders(),
      status: res.statusCode,
      contentLength: responseData.length || (responseData.error && responseData.error.length) || 0
    });

    // Log CORS-related response headers
    logger.info('CORS-related response headers:', {
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': res.getHeader('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': res.getHeader('Access-Control-Allow-Headers'),
      'Access-Control-Allow-Credentials': res.getHeader('Access-Control-Allow-Credentials')
    });

    // Log if Access-Control-Allow-Origin is missing
    if (!res.getHeader('Access-Control-Allow-Origin')) {
      logger.warn('Access-Control-Allow-Origin header is missing in the response');
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
  logger.info('Handling OPTIONS request');
  setCorsHeaders(req, res);
  res.sendStatus(204);
});

app.listen(port, '0.0.0.0', () => {
  logger.info(`Proxy server running on 0.0.0.0:${port}`);
  logger.info(`CORS enabled for all origins`);
});
