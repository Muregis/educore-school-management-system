import winston from 'winston';
import { env } from '../config/env.js';

/**
 * Structured Logger
 * Replaces morgan with enterprise-grade logging
 * Supports multiple log levels and structured output
 */

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  })
];

// Add file transport in production
if (env.nodeEnv === 'production') {
  transports.push(
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  );
}

export const logger = winston.createLogger({
  level: env.nodeEnv === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports,
  exitOnError: false
});

/**
 * Request logging middleware
 */
export function requestLogger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      requestId: req.id,
      userId: req.user?.id,
      schoolId: req.user?.schoolId
    });
  });
  
  next();
}
