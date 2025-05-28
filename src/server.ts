import express from 'express'
import cors from 'cors'
import { config } from './config/config'
import { ApiLinterHTTPClient } from './utils/apiLinterHttpClient'
import { ApiLinterRepository } from './repositories/apiLinterRepository'
import { ApiLinterService } from './services/apiLinterService'
import { McpService } from './services/mcpService'
import { HealthCheckService } from './services/healthCheckService'
import { StreamableHttpController } from './controllers/streamableHttpController'
import { LoggerService, getLogger } from './utils/logger'
import { metricsMiddleware } from './middleware/metricsMiddleware'
import { MetricsController } from './controllers/metricsController'
import { Metrics } from './utils/metrics'

async function main() {
    try {
        // Initialize the logger (now configured for stdout)
        LoggerService.initialize(config)
        const logger = getLogger()

        logger.info('Starting API Linter MCP Server')
        logger.debug('Server configuration', {
            config: {
                ...config,
                apiLinter: { ...config.apiLinter, url: '***' },
            },
        })

        const apiLinterHttpClient = new ApiLinterHTTPClient(config.url, {
            timeout: config.apiLinter.timeout,
            retryOptions: config.apiLinter.retry,
            circuitBreakerOptions: config.apiLinter.circuitBreaker,
            logger,
        })

        const apiLinterRepository = new ApiLinterRepository(apiLinterHttpClient)
        const apiLinterService = new ApiLinterService(
            apiLinterRepository,
            logger
        )
        const mcpService = new McpService(apiLinterService, logger)

        // Create health check service
        const healthCheckService = new HealthCheckService(
            apiLinterService,
            logger,
            { checkIntervalMs: config.healthCheck.checkIntervalMs }
        )

        // Force an initial health check with timeout
        try {
            logger.info('Performing initial health check')
            const initialCheckPromise = healthCheckService.forceCheck()

            // Use Promise.race to implement timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(
                        new Error(
                            `Initial health check timed out after ${config.healthCheck.initialCheckTimeoutMs}ms`
                        )
                    )
                }, config.healthCheck.initialCheckTimeoutMs)
            })

            await Promise.race([initialCheckPromise, timeoutPromise])
            logger.info('Initial health check completed successfully')
        } catch (error) {
            logger.warn('Initial health check failed, continuing startup', {
                error,
            })

            // Record error in metrics
            Metrics.recordError('server')
        }

        const app = express()

        app.use(
            cors({
                origin: config.allowedOrigins,
                methods: ['OPTIONS', 'POST', 'GET'],
            })
        )

        // Add metrics middleware to track all HTTP requests
        app.use(metricsMiddleware)

        // Add request logging middleware
        app.use((req, res, next) => {
            const start = Date.now()

            res.on('finish', () => {
                const duration = Date.now() - start
                logger.http(
                    `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`
                )
            })

            next()
        })

        // Enhanced health check endpoint
        app.get('/health', async (req, res) => {
            try {
                const health = await healthCheckService.getHealth()

                // Set status code based on health status
                const statusCode = health.status === 'ok' ? 200 : 503

                res.status(statusCode).json(health)
            } catch (error) {
                logger.error('Error getting health status', { error })

                // Record error metric
                Metrics.recordError('server')

                res.status(500).json({
                    status: 'unhealthy',
                    uptime: process.uptime(),
                    timestamp: new Date().toISOString(),
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                })
            }
        })

        // Initialize the metrics endpoint
        new MetricsController(app, logger)

        // Initialize the MCP streamable HTTP controller
        new StreamableHttpController(app, mcpService.getServer(), logger)

        // Start the server
        app.listen(config.port, () => {
            logger.info(
                `MCP Server running in Streamable HTTP connections mode on endpoint http://localhost:${config.port}/mcp`
            )
            logger.info(
                `Health check available at http://localhost:${config.port}/health`
            )
            logger.info(
                `Metrics endpoint available at http://localhost:${config.port}/metrics`
            )
        })
    } catch (error) {
        // If logger is initialized, use it; otherwise fallback to console
        try {
            const logger = getLogger()
            logger.error('Error starting server:', error)

            // Record server error in metrics
            Metrics.recordError('server')
        } catch {
            console.error('Error starting server:', error)
        }

        process.exit(1)
    }
}

// Handle uncaught exceptions and unhandled promise rejections
process.on('uncaughtException', (error) => {
    try {
        const logger = getLogger()
        logger.error('Uncaught exception:', error)

        // Record server error in metrics
        Metrics.recordError('server')
    } catch {
        console.error('Uncaught exception:', error)
    }

    process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
    try {
        const logger = getLogger()
        logger.error('Unhandled promise rejection:', { reason, promise })

        // Record server error in metrics
        Metrics.recordError('server')
    } catch {
        console.error('Unhandled promise rejection:', reason)
    }
})

main()
