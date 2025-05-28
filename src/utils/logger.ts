import winston from 'winston'
import { Config } from '../config/config'

/**
 * Log levels for the application.
 * Follows the RFC5424 severity levels:
 * - error: 0
 * - warn: 1
 * - info: 2
 * - http: 3
 * - verbose: 4
 * - debug: 5
 * - silly: 6
 */
export enum LogLevel {
    ERROR = 'error',
    WARN = 'warn',
    INFO = 'info',
    HTTP = 'http',
    DEBUG = 'debug',
}

/**
 * Creates a Winston logger instance configured for container environments.
 * All logs are directed to stdout/stderr instead of files.
 * @param config - The application configuration
 * @returns A configured logger instance
 */
export function createLogger(config: Config) {
    // Define the log format for structured JSON logging
    const jsonLogFormat = winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    )

    // Define console format with colors for better readability in development
    const consoleFormat = winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize({ all: true }),
        winston.format.printf(
            (info) =>
                `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`
        )
    )

    // Choose format based on environment
    const logFormat =
        config.environment === 'production' ? jsonLogFormat : consoleFormat

    // Create the logger with configurations
    // Only use console transport which will log to stdout/stderr
    const logger = winston.createLogger({
        level: config.logging.level || 'info',
        format: logFormat,
        defaultMeta: { service: 'api-linter-mcp' },
        transports: [
            // Console transport logs errors to stderr and everything else to stdout
            new winston.transports.Console(),
        ],
    })

    return logger
}

// Create a type for our logger
export type AppLogger = ReturnType<typeof createLogger>

// Create a class to provide a singleton logger
export class LoggerService {
    private static instance: AppLogger

    /**
     * Gets the logger instance.
     * Must call initialize first with valid config.
     */
    public static getInstance(): AppLogger {
        if (!LoggerService.instance) {
            throw new Error(
                'Logger has not been initialized. Call LoggerService.initialize first.'
            )
        }
        return LoggerService.instance
    }

    /**
     * Initializes the logger with configuration.
     * @param config - Application configuration
     */
    public static initialize(config: Config): void {
        LoggerService.instance = createLogger(config)
    }
}

/**
 * Convenience function to get the logger instance
 * @returns The logger instance
 */
export function getLogger(): AppLogger {
    return LoggerService.getInstance()
}
