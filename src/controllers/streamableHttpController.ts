import { Express, Request, Response } from 'express'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { AppLogger } from '../utils/logger'
import { Metrics } from '../utils/metrics'

/**
 * Controller that handles Streamable HTTP connections.
 * Implements a stateless MCP server according to the 2025-03-26 specification.
 * Includes metrics tracking for MCP connections and requests.
 */
export class StreamableHttpController {
    private app: Express
    private mcpServer: McpServer
    private logger: AppLogger
    private readonly MCP_ENDPOINT = '/mcp'
    // Track active connections
    private activeConnections: number = 0

    /**
     * Creates a new Streamable HTTP controller.
     * @param app - The Express application instance
     * @param mcpServer - The Model Context Protocol server instance
     * @param logger - The application logger
     */
    constructor(app: Express, mcpServer: McpServer, logger: AppLogger) {
        this.app = app
        this.mcpServer = mcpServer
        this.logger = logger
        this.setupRoutes()
        this.logger.debug('StreamableHttpController initialized')
    }

    /**
     * Sets up the HTTP routes for the MCP endpoint.
     * Configures GET, POST, and OPTIONS methods for the endpoint.
     */
    private setupRoutes(): void {
        this.logger.debug(`Setting up routes for ${this.MCP_ENDPOINT}`)
        // Handle both GET and POST requests at the single MCP endpoint
        this.app.get(this.MCP_ENDPOINT, this.handleMcpRequest.bind(this))
        this.app.post(this.MCP_ENDPOINT, this.handleMcpRequest.bind(this))
        // Set up OPTIONS for CORS preflight requests
        this.app.options(this.MCP_ENDPOINT, (req, res) => {
            this.logger.debug(
                `Handling OPTIONS request for ${this.MCP_ENDPOINT}`
            )
            res.status(204).end()
        })
    }

    /**
     * Handles incoming requests to the MCP endpoint.
     * Supports POST requests and validates the Origin header for security.
     * Creates a stateless transport for handling the request and connects it to the MCP server.
     * Tracks metrics for MCP requests and connections.
     * @param req - The HTTP request object
     * @param res - The HTTP response object
     */
    private async handleMcpRequest(req: Request, res: Response): Promise<void> {
        const requestId = req.headers['x-request-id'] || `req-${Date.now()}`
        const startTime = Date.now()
        this.logger.debug(
            `Handling ${req.method} request to ${this.MCP_ENDPOINT}`,
            { requestId }
        )

        try {
            // Check for unsupported HTTP methods
            if (req.method === 'GET' || req.method === 'DELETE') {
                this.logger.debug(
                    `Received unsupported ${req.method} request at ${this.MCP_ENDPOINT}`,
                    { requestId }
                )
                res.status(405).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32000,
                        message: 'Method not allowed.',
                    },
                    id: null,
                })

                // Record client error metric
                Metrics.recordError('client')
                // Record MCP request with error status
                Metrics.recordMcpRequest('streamable-http', 'error')
                return
            }

            // Validate Origin header for security
            try {
                this.validateOrigin(req, res)
                this.logger.debug('Origin validation passed', {
                    requestId,
                    origin: req.headers.origin || 'none',
                })
            } catch (error) {
                this.logger.warn('Origin validation failed', {
                    requestId,
                    origin: req.headers.origin,
                    error,
                })
                res.status(403).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32003,
                        message: 'Forbidden: Invalid origin',
                    },
                    id: null,
                })

                // Record client error metric
                Metrics.recordError('client')
                // Record MCP request with error status
                Metrics.recordMcpRequest('streamable-http', 'error')
                return
            }

            // Create a new stateless transport for this request
            this.logger.debug('Creating new stateless transport', { requestId })
            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined, // Set to undefined for stateless mode
                enableJsonResponse: true, // Use JSON responses for simpler implementation
            })

            // Connect the MCP server to this transport
            this.logger.debug('Connecting MCP server to transport', {
                requestId,
            })
            res.on('close', () => {
                // Measure request duration on close
                const duration = Date.now() - startTime

                this.logger.debug(
                    'Closing transport and MCP server on request close',
                    { requestId, duration: `${duration}ms` }
                )

                // Record MCP request success metric
                Metrics.recordMcpRequest('streamable-http', 'success')

                transport.close().catch((err) => {
                    this.logger.error('Error closing transport', {
                        requestId,
                        error: err,
                    })
                    Metrics.recordError('server')
                })

                this.mcpServer.close().catch((err) => {
                    this.logger.error('Error closing MCP server', {
                        requestId,
                        error: err,
                    })
                    Metrics.recordError('server')
                })
            })

            // Connect
            this.logger.debug('Connect MCP request with transport', {
                requestId,
            })
            await this.mcpServer.connect(transport)
            // Handle the request
            this.logger.debug('Processing MCP request with transport', {
                requestId,
            })

            await transport.handleRequest(req, res, req.body)
        } catch (error) {
            this.logger.error('Error handling MCP request', {
                requestId,
                error,
                stack: error instanceof Error ? error.stack : undefined,
            })

            // Record server error metric
            Metrics.recordError('server')
            // Record MCP request with error status
            Metrics.recordMcpRequest('streamable-http', 'error')

            res.status(500).json({
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Internal server error',
                },
                id: null,
            })
        }
    }

    /**
     * Validates the Origin header to prevent DNS rebinding attacks.
     * Throws an error if the Origin header is invalid.
     * @param req - The HTTP request object
     * @param res - The HTTP response object
     */
    private validateOrigin(req: Request, res: Response): void {
        const origin = req.headers.origin

        // Allow requests without Origin (like curl, Postman, etc.)
        if (!origin) return

        // Check against allowed origins - this is a simple check, you might want to enhance
        // with a more robust validation for your specific requirements
        const allowedOrigins = [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            // Add any other trusted origins here
        ]

        if (!allowedOrigins.includes(origin)) {
            throw new Error('Invalid origin')
        }
    }
}
