import { Request, Response, NextFunction } from 'express'
import { Metrics } from '../utils/metrics'

/**
 * Express middleware to track HTTP request metrics
 *
 * This middleware measures:
 * - Request count by method, route, and status code
 * - Request duration in seconds
 *
 * It's applied as Express middleware to automatically measure all requests through the app.
 */
export function metricsMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
) {
    // Record start time
    const startTime = Date.now()

    // Store the original URL to ensure consistent route names
    const originalUrl = req.originalUrl

    // Get route path for grouping similar URLs
    const route = req.route
        ? req.baseUrl + req.route.path
        : req.url.split('?')[0] || originalUrl.split('?')[0]

    // Function to handle response finish event
    const recordMetrics = () => {
        // Calculate duration
        const durationMs = Date.now() - startTime

        // Record HTTP metrics
        Metrics.recordHttpRequest(req.method, route, res.statusCode, durationMs)

        // Clean up - remove event listener to prevent memory leaks
        res.removeListener('finish', recordMetrics)
        res.removeListener('close', recordMetrics)
    }

    // Listen for response completion events
    res.on('finish', recordMetrics)
    res.on('close', recordMetrics) // Also capture aborted requests

    // Continue request processing
    next()
}
