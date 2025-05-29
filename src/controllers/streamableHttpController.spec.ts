import { StreamableHttpController } from './streamableHttpController'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import express, { Express, Request, Response } from 'express'
import { AppLogger } from '../utils/logger'

// Mock modules
jest.mock('@modelcontextprotocol/sdk/server/mcp.js')
jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js')
jest.mock('../utils/logger', () => {
    // Create a mock logger with all required methods
    const mockLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        http: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
    }

    return {
        getLogger: jest.fn().mockReturnValue(mockLogger),
        LoggerService: {
            getInstance: jest.fn().mockReturnValue(mockLogger),
        },
        AppLogger: jest.fn(),
    }
})

describe('StreamableHttpController', () => {
    let controller: StreamableHttpController
    let mockApp: Express
    let mockMcpServer: jest.Mocked<McpServer>
    let mockTransport: jest.Mocked<StreamableHTTPServerTransport>
    let mockLogger: AppLogger

    // Mock request and response objects
    const mockRequest = (
        method: string = 'POST',
        headers: Record<string, string> = {}
    ) => {
        return {
            method,
            headers,
            on: jest.fn(),
        } as unknown as Request
    }

    const mockResponse = () => {
        const res: Partial<Response> = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            end: jest.fn().mockReturnThis(),
            on: jest.fn(),
            setHeader: jest.fn(),
            flushHeaders: jest.fn(),
        }
        return res as Response
    }

    beforeEach(() => {
        jest.clearAllMocks()

        // Create mock app with required methods
        mockApp = {
            get: jest.fn(),
            post: jest.fn(),
            options: jest.fn(),
        } as unknown as Express

        // Create mock MCP server
        mockMcpServer = {
            connect: jest.fn().mockResolvedValue(undefined),
            close: jest.fn().mockResolvedValue(undefined),
        } as unknown as jest.Mocked<McpServer>

        // Create mock transport
        mockTransport = {
            handleRequest: jest.fn().mockResolvedValue(undefined),
            close: jest.fn().mockResolvedValue(undefined),
        } as unknown as jest.Mocked<StreamableHTTPServerTransport>

        // Create mock logger
        mockLogger = {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            http: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
        } as unknown as AppLogger

        // Mock the StreamableHTTPServerTransport constructor
        ;(StreamableHTTPServerTransport as jest.Mock).mockImplementation(
            () => mockTransport
        )

        // Create controller instance with logger
        controller = new StreamableHttpController(
            mockApp,
            mockMcpServer,
            mockLogger
        )
    })

    describe('initialization', () => {
        it('should set up routes during construction', () => {
            expect(mockApp.get).toHaveBeenCalledWith(
                '/mcp',
                expect.any(Function)
            )
            expect(mockApp.post).toHaveBeenCalledWith(
                '/mcp',
                expect.any(Function)
            )
            expect(mockApp.options).toHaveBeenCalledWith(
                '/mcp',
                expect.any(Function)
            )
            // Verify logger was used during initialization
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'StreamableHttpController initialized'
            )
        })
    })

    describe('request handling', () => {
        it('should handle POST requests correctly', async () => {
            // Get the POST handler
            const postHandler = (mockApp.post as jest.Mock).mock.calls[0][1]

            const req = mockRequest('POST')
            const res = mockResponse()

            await postHandler(req, res)

            // Verify logger was used
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringMatching(/Handling POST request/),
                expect.any(Object)
            )

            // Check that a transport was created with the correct configuration
            expect(StreamableHTTPServerTransport).toHaveBeenCalledWith({
                sessionIdGenerator: undefined,
                enableJsonResponse: true,
            })

            // Check that the server was connected to the transport
            expect(mockMcpServer.connect).toHaveBeenCalledWith(mockTransport)

            // Check that the request was handled
            expect(mockTransport.handleRequest).toHaveBeenCalledWith(
                req,
                res,
                req.body
            )

            // Verify processing was logged
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Processing MCP request with transport',
                expect.any(Object)
            )
        })

        it('should handle GET requests correctly', async () => {
            // Get the GET handler
            const getHandler = (mockApp.get as jest.Mock).mock.calls[0][1]

            const req = mockRequest('GET')
            const res = mockResponse()

            await getHandler(req, res)

            // Verify logger was used
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringMatching(/Handling GET request/),
                expect.any(Object)
            )

            // GET requests should be logged as unsupported
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringMatching(/Received unsupported GET request/),
                expect.any(Object)
            )

            // GET requests should return 405 Method Not Allowed
            expect(res.status).toHaveBeenCalledWith(405)
            expect(res.json).toHaveBeenCalledWith({
                jsonrpc: '2.0',
                error: {
                    code: -32000,
                    message: 'Method not allowed.',
                },
                id: null,
            })
        })

        it('should handle OPTIONS requests correctly', async () => {
            // Get the OPTIONS handler
            const optionsHandler = (mockApp.options as jest.Mock).mock
                .calls[0][1]

            const req = mockRequest('OPTIONS')
            const res = mockResponse()

            await optionsHandler(req, res)

            // Verify logger was used for OPTIONS request
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Handling OPTIONS request for /mcp'
            )

            // OPTIONS should return 204 No Content
            expect(res.status).toHaveBeenCalledWith(204)
            expect(res.end).toHaveBeenCalled()
        })

        it('should validate Origin header', async () => {
            // Get the POST handler
            const postHandler = (mockApp.post as jest.Mock).mock.calls[0][1]

            // Create request with invalid origin
            const req = mockRequest('POST', {
                origin: 'https://malicious-site.com',
            })
            const res = mockResponse()

            await postHandler(req, res)

            // Verify logger captured the origin validation failure
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Origin validation failed',
                expect.objectContaining({
                    origin: 'https://malicious-site.com',
                })
            )

            // Should return 403 due to invalid origin
            expect(res.status).toHaveBeenCalledWith(403)
            expect(res.json).toHaveBeenCalledWith({
                jsonrpc: '2.0',
                error: {
                    code: -32003,
                    message: 'Forbidden: Invalid origin',
                },
                id: null,
            })

            // Ensure transport wasn't created for invalid origin
            expect(StreamableHTTPServerTransport).not.toHaveBeenCalled()
        })

        it('should allow requests with valid Origin header', async () => {
            // Get the POST handler
            const postHandler = (mockApp.post as jest.Mock).mock.calls[0][1]

            // Create request with valid origin
            const req = mockRequest('POST', { origin: 'http://localhost:3000' })
            const res = mockResponse()

            await postHandler(req, res)

            // Verify origin validation passed was logged
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Origin validation passed',
                expect.objectContaining({
                    origin: 'http://localhost:3000',
                })
            )

            // Should process the request normally
            expect(StreamableHTTPServerTransport).toHaveBeenCalled()
            expect(mockMcpServer.connect).toHaveBeenCalled()
            expect(mockTransport.handleRequest).toHaveBeenCalled()
        })

        it('should allow requests without Origin header', async () => {
            // Get the POST handler
            const postHandler = (mockApp.post as jest.Mock).mock.calls[0][1]

            // Create request without origin
            const req = mockRequest('POST', {})
            const res = mockResponse()

            await postHandler(req, res)

            // Verify origin validation passed was logged
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Origin validation passed',
                expect.objectContaining({
                    origin: 'none',
                })
            )

            // Should process the request normally
            expect(StreamableHTTPServerTransport).toHaveBeenCalled()
            expect(mockMcpServer.connect).toHaveBeenCalled()
            expect(mockTransport.handleRequest).toHaveBeenCalled()
        })

        it('should close transport and server on request close', async () => {
            // Get the POST handler
            const postHandler = (mockApp.post as jest.Mock).mock.calls[0][1]

            const req = mockRequest('POST')
            const res = mockResponse()

            // Trigger the request
            await postHandler(req, res)

            // Get the 'close' callback function
            const closeCallback = (res.on as jest.Mock).mock.calls[0][1]

            // Simulate the 'close' event
            closeCallback()

            // Verify logger captured the closing
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Closing transport and MCP server on request close',
                expect.any(Object)
            )

            // Verify transport and server were closed
            expect(mockTransport.close).toHaveBeenCalled()
            expect(mockMcpServer.close).toHaveBeenCalled()
        })

        it('should handle errors during request processing', async () => {
            // Get the POST handler
            const postHandler = (mockApp.post as jest.Mock).mock.calls[0][1]

            // Force an error by making handleRequest throw
            const testError = new Error('Test error')
            mockTransport.handleRequest.mockRejectedValueOnce(testError)

            const req = mockRequest('POST')
            const res = mockResponse()

            // Process the request
            await postHandler(req, res)

            // Verify error was logged
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error handling MCP request',
                expect.objectContaining({
                    error: testError,
                    stack: expect.any(String),
                })
            )

            // Should return 500 with error details
            expect(res.status).toHaveBeenCalledWith(500)
            expect(res.json).toHaveBeenCalledWith({
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Internal server error',
                },
                id: null,
            })
        })
    })
})
