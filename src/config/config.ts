import { CircuitBreakerOptions } from '../circuitbreaker/circuitBreaker'
import { RetryOptions } from '../circuitbreaker/retry'
import { LogLevel } from '../utils/logger'

export interface LoggingConfig {
    level: LogLevel
}

export interface HealthCheckConfig {
    checkIntervalMs: number
    initialCheckTimeoutMs: number
}

export interface Config {
    environment: 'development' | 'test' | 'production'
    port: number
    url: string
    apiLinter: {
        timeout: number
        retry: Partial<RetryOptions>
        circuitBreaker: Partial<CircuitBreakerOptions>
    }
    logging: LoggingConfig
    healthCheck: HealthCheckConfig
    allowedOrigins: string[]
}

/**
 * Application configuration object.
 * Values are loaded from environment variables with fallbacks.
 * Configuration is optimized for container deployment.
 */
export const config: Config = {
    environment:
        (process.env.NODE_ENV as 'development' | 'test' | 'production') ||
        'development',
    port: parseInt(process.env.PORT || '8080', 10),
    url:
        process.env.APILINTER_URL ||
        'http://localhost:8080',
    apiLinter: {
        timeout: parseInt(process.env.APILINTER_TIMEOUT || '10000', 10),
        retry: {
            maxRetries: parseInt(process.env.APILINTER_MAX_RETRIES || '3', 10),
            initialDelayMs: parseInt(
                process.env.APILINTER_INITIAL_DELAY || '500',
                10
            ),
            maxDelayMs: parseInt(process.env.APILINTER_MAX_DELAY || '5000', 10),
        },
        circuitBreaker: {
            failureThreshold: parseInt(
                process.env.APILINTER_FAILURE_THRESHOLD || '5',
                10
            ),
            resetTimeout: parseInt(
                process.env.APILINTER_RESET_TIMEOUT || '30000',
                10
            ),
        },
    },
    logging: {
        level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
    },
    healthCheck: {
        checkIntervalMs: parseInt(
            process.env.HEALTH_CHECK_INTERVAL || '60000',
            10
        ), // Default to 1 minute
        initialCheckTimeoutMs: parseInt(
            process.env.HEALTH_CHECK_TIMEOUT || '5000',
            10
        ), // Default to 5 seconds for initial check
    },
    allowedOrigins: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',')
        : ['http://localhost:8080', 'http://127.0.0.1:8080'],
}
