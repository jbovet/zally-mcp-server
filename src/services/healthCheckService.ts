/**
 * Service responsible for monitoring and reporting the health status of the application.
 * It performs periodic health checks on dependent services like the API Linter,
 * and provides an overall health status.
 *
 * @remarks
 * The health check is performed at a configurable interval to avoid unnecessary resource usage.
 * Between intervals, cached results are returned for performance.
 */
import { ApiLinterService } from './apiLinterService'
import { AppLogger } from '../utils/logger'

/**
 * Represents the health status of the application and its services.
 *
 * @interface HealthStatus
 * @property {('ok'|'degraded'|'unhealthy')} status - The overall health status of the application.
 * @property {number} uptime - The uptime of the application in seconds.
 * @property {string} timestamp - The ISO timestamp when the health status was generated.
 * @property {object} services - The health status of individual services.
 * @property {object} services.apiLinter - The health status of the API Linter service.
 * @property {('ok'|'degraded'|'unhealthy')} services.apiLinter.status - The health status of the API Linter service.
 * @property {string} [services.apiLinter.message] - Optional message providing details about the API Linter service status.
 * @property {string} services.apiLinter.lastChecked - The ISO timestamp when the API Linter service was last checked.
 * @property {string} version - The version of the application.
 */
export interface HealthStatus {
    status: 'ok' | 'unhealthy'
    uptime: number
    timestamp: string
    services: {
        apiLinter: {
            status: 'ok' | 'unhealthy'
            message?: string
            lastChecked: string
        }
    }
    version: string
}

/**
 * Service that handles application health checks
 */
export class HealthCheckService {
    private apiLinterService: ApiLinterService
    private logger: AppLogger
    private lastApiLinterCheck: Date | null = null
    private apiLinterStatus: 'ok' | 'unhealthy' = 'unhealthy'
    private apiLinterMessage?: string
    private checkIntervalMs: number
    private lastCheckTime: number = 0

    constructor(
        apiLinterService: ApiLinterService,
        logger: AppLogger,
        options: { checkIntervalMs?: number } = {}
    ) {
        this.apiLinterService = apiLinterService
        this.logger = logger
        this.checkIntervalMs = options.checkIntervalMs || 60000 // Default to 1 minute
        this.logger.debug('HealthCheckService initialized', {
            checkIntervalMs: this.checkIntervalMs,
        })
    }

    /**
     * Gets the current health status of the application
     * Performs an actual check only if the interval has passed since last check
     */
    async getHealth(): Promise<HealthStatus> {
        const now = Date.now()

        // Check if we need to refresh the API Linter status based on interval
        if (now - this.lastCheckTime >= this.checkIntervalMs) {
            try {
                await this.checkApiLinterHealth()
                this.lastCheckTime = now
            } catch (error) {
                this.logger.error('Error during health check', { error })
            }
        }

        const status = this.determineOverallStatus()

        return {
            status,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            services: {
                apiLinter: {
                    status: this.apiLinterStatus,
                    message: this.apiLinterMessage,
                    lastChecked:
                        this.lastApiLinterCheck?.toISOString() || 'never',
                },
            },
            version: process.env.npm_package_version || '1.0.0',
        }
    }

    /**
     * Forces an immediate check of the API Linter service availability
     */
    async forceCheck(): Promise<void> {
        await this.checkApiLinterHealth()
        this.lastCheckTime = Date.now()
    }

    /**
     * Checks the health of the API Linter service
     * This is done by making a lightweight call to the API Linter service
     */
    private async checkApiLinterHealth(): Promise<void> {
        this.logger.debug('Checking API Linter service health')

        try {
            // Use a lightweight operation to check connectivity
            // Getting rules is a good test as it's simple and should be quick
            await this.apiLinterService.getLintingRules()

            this.apiLinterStatus = 'ok'
            this.apiLinterMessage = 'API Linter service is available'
            this.logger.debug('API Linter health check successful')
        } catch (error) {
            this.apiLinterStatus = 'unhealthy'
            this.apiLinterMessage =
                error instanceof Error
                    ? `API Linter service unavailable: ${error.message}`
                    : 'API Linter service unavailable: Unknown error'

            this.logger.warn('API Linter health check failed', {
                error,
                message: this.apiLinterMessage,
            })
        }

        this.lastApiLinterCheck = new Date()
    }

    /**
     * Determines the overall status based on component statuses
     */
    private determineOverallStatus(): 'ok' | 'unhealthy' {
        if (this.apiLinterStatus === 'unhealthy') {
            return 'unhealthy'
        }
        return 'ok'
    }
}
