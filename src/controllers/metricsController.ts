import { Express, Request, Response } from 'express'
import { Metrics } from '../utils/metrics'
import { AppLogger } from '../utils/logger'

/**
 * Sets up metrics endpoints in the Express application
 *
 * This adds a /metrics endpoint that exposes Prometheus metrics in text format,
 * suitable for scraping by a Prometheus server.
 */
export class MetricsController {
    private app: Express
    private logger: AppLogger

    /**
     * Creates a new metrics endpoint handler
     * @param app - The Express application instance
     * @param logger - The application logger
     */
    constructor(app: Express, logger: AppLogger) {
        this.app = app
        this.logger = logger
        this.setupEndpoints()
        this.logger.debug('MetricsEndpoint initialized')
    }

    /**
     * Sets up the metrics endpoint
     */
    private setupEndpoints(): void {
        this.app.get('/metrics', async (req: Request, res: Response) => {
            try {
                // Get metrics in Prometheus format
                const metrics = await Metrics.getMetrics()

                // Set correct content type for Prometheus metrics
                res.setHeader('Content-Type', 'text/plain')
                res.send(metrics)

                this.logger.debug('Metrics requested', {
                    remoteAddress: req.ip,
                    contentLength: metrics.length,
                })
            } catch (error) {
                this.logger.error('Error generating metrics', { error })
                res.status(500).send('Error generating metrics')
            }
        })
    }
}
