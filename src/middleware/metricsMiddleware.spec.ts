import { metricsMiddleware } from './metricsMiddleware'
import { Metrics } from '../utils/metrics'
import { Request, Response, NextFunction } from 'express'

// Mock Metrics module
jest.mock('../utils/metrics', () => {
    return {
        Metrics: {
            recordHttpRequest: jest.fn(),
            recordError: jest.fn(),
            updateConnections: jest.fn(),
            recordMcpTool: jest.fn(),
            updateMcpResourceCount: jest.fn(),
            incrementMcpToolInvocation: jest.fn(),
            recordMcpToolDuration: jest.fn(),
            getMetrics: jest.fn(),
            resetMetrics: jest.fn(),
        },
    }
})

describe('metricsMiddleware', () => {
    let mockRequest: Partial<Request>
    let mockResponse: Partial<Response>
    let nextFunction: NextFunction
    let finishCallback: () => void
    let closeCallback: () => void

    beforeEach(() => {
        jest.clearAllMocks()

        // Reset timer mocks
        jest.useFakeTimers()

        // Create mock request
        mockRequest = {
            method: 'GET',
            originalUrl: '/test/endpoint',
            url: '/test/endpoint',
            route: {
                path: '/endpoint',
            },
            baseUrl: '/test',
        }

        // Mock response event listeners and finish/close events
        // Initialize with empty functions instead of null
        finishCallback = () => {}
        closeCallback = () => {}

        mockResponse = {
            statusCode: 200,
            on: jest.fn((event, callback) => {
                if (event === 'finish') finishCallback = callback
                if (event === 'close') closeCallback = callback
                return mockResponse as Response
            }),
            removeListener: jest.fn(),
        }

        // Mock next function
        nextFunction = jest.fn()
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    it('should call next() to continue the middleware chain', () => {
        metricsMiddleware(
            mockRequest as Request,
            mockResponse as Response,
            nextFunction
        )
        expect(nextFunction).toHaveBeenCalled()
    })

    it('should attach event listeners to the response object', () => {
        metricsMiddleware(
            mockRequest as Request,
            mockResponse as Response,
            nextFunction
        )

        expect(mockResponse.on).toHaveBeenCalledWith(
            'finish',
            expect.any(Function)
        )
        expect(mockResponse.on).toHaveBeenCalledWith(
            'close',
            expect.any(Function)
        )
    })

    it('should record metrics when response finishes', () => {
        // Advance mock time by 500ms
        const elapsedTime = 500

        // Call the middleware
        metricsMiddleware(
            mockRequest as Request,
            mockResponse as Response,
            nextFunction
        )

        // Advance time
        jest.advanceTimersByTime(elapsedTime)

        // Trigger finish event
        finishCallback()

        // Check that metrics were recorded
        expect(Metrics.recordHttpRequest).toHaveBeenCalledWith(
            mockRequest.method,
            '/test/endpoint',
            mockResponse.statusCode,
            elapsedTime
        )
    })

    it('should handle dynamic route parameters correctly', () => {
        // Create request with dynamic route
        const dynamicRequest = {
            method: 'GET',
            originalUrl: '/users/123/profile',
            url: '/users/123/profile',
            route: {
                path: '/users/:id/profile',
            },
            baseUrl: '',
        }

        // Call the middleware
        metricsMiddleware(
            dynamicRequest as Request,
            mockResponse as Response,
            nextFunction
        )

        // Trigger finish event
        finishCallback()

        // Check that the route was normalized correctly using the route path
        expect(Metrics.recordHttpRequest).toHaveBeenCalledWith(
            'GET',
            '/users/:id/profile', // Should use the route pattern, not the specific instance
            200,
            expect.any(Number)
        )
    })

    it('should fall back to URL path when route is not available', () => {
        // Create request without route information
        const noRouteRequest = {
            method: 'GET',
            originalUrl: '/api/data?id=123',
            url: '/api/data?id=123',
            // No route property
            baseUrl: '',
        }

        // Call the middleware
        metricsMiddleware(
            noRouteRequest as Request,
            mockResponse as Response,
            nextFunction
        )

        // Trigger finish event
        finishCallback()

        // Check that it uses URL path without query parameters
        expect(Metrics.recordHttpRequest).toHaveBeenCalledWith(
            'GET',
            '/api/data',
            200,
            expect.any(Number)
        )
    })

    it('should clean up event listeners after recording metrics', () => {
        // Call the middleware
        metricsMiddleware(
            mockRequest as Request,
            mockResponse as Response,
            nextFunction
        )

        // Trigger finish event
        finishCallback()

        // Verify that event listeners were removed
        expect(mockResponse.removeListener).toHaveBeenCalledWith(
            'finish',
            finishCallback
        )
        expect(mockResponse.removeListener).toHaveBeenCalledWith(
            'close',
            finishCallback
        )
    })

    it('should handle both finish and close events', () => {
        // Call the middleware
        metricsMiddleware(
            mockRequest as Request,
            mockResponse as Response,
            nextFunction
        )

        // Trigger close event instead of finish
        closeCallback()

        // Metrics should still be recorded
        expect(Metrics.recordHttpRequest).toHaveBeenCalled()
    })

    it('should handle different status codes', () => {
        // Set up response with error status
        const errorResponse = {
            ...mockResponse,
            statusCode: 500,
        }

        // Call the middleware
        metricsMiddleware(
            mockRequest as Request,
            errorResponse as Response,
            nextFunction
        )

        // Trigger finish event
        finishCallback()

        // Verify status code is passed to metrics
        expect(Metrics.recordHttpRequest).toHaveBeenCalledWith(
            'GET',
            expect.any(String),
            500,
            expect.any(Number)
        )
    })
})
