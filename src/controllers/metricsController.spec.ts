import { MetricsController } from './metricsController'
import { Express, Request, Response } from 'express'
import { Metrics } from '../utils/metrics'
import { AppLogger } from '../utils/logger'

// Mock dependencies
jest.mock('../utils/metrics', () => ({
    Metrics: {
        getMetrics: jest.fn(),
    },
}))

jest.mock('../utils/logger', () => ({
    AppLogger: jest.fn().mockImplementation(() => ({
        debug: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
    })),
}))

describe('MetricsController', () => {
    let mockApp: Partial<Express>
    let mockLogger: AppLogger
    let mockRequest: Partial<Request>
    let mockResponse: Partial<Response>
    let mockGetHandler: jest.Mock

    beforeEach(() => {
        jest.clearAllMocks()

        // Setup mock request and response
        mockRequest = {
            ip: '127.0.0.1',
        }

        mockResponse = {
            setHeader: jest.fn(),
            send: jest.fn(),
            status: jest.fn().mockReturnThis(),
        }

        // Setup mock Express app
        mockGetHandler = jest.fn()
        mockApp = {
            get: mockGetHandler,
        }

        // Setup mock logger
        mockLogger = new (jest.requireMock(
            '../utils/logger'
        ).AppLogger)() as AppLogger

        // Initialize controller
        new MetricsController(mockApp as Express, mockLogger)
    })

    it('should register the metrics endpoint on initialization', () => {
        // Verify that the endpoint was registered
        expect(mockGetHandler).toHaveBeenCalledWith(
            '/metrics',
            expect.any(Function)
        )
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'MetricsEndpoint initialized'
        )
    })

    it('should return metrics data when endpoint is called', async () => {
        // Mock metrics data
        const mockMetricsData = 'mock prometheus metrics data'
        ;(Metrics.getMetrics as jest.Mock).mockResolvedValue(mockMetricsData)

        // Get the registered handler function
        const handlerFn = mockGetHandler.mock.calls[0][1]

        // Call the handler
        await handlerFn(mockRequest, mockResponse)

        // Verify response
        expect(Metrics.getMetrics).toHaveBeenCalled()
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
            'Content-Type',
            'text/plain'
        )
        expect(mockResponse.send).toHaveBeenCalledWith(mockMetricsData)
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'Metrics requested',
            expect.objectContaining({
                remoteAddress: '127.0.0.1',
                contentLength: mockMetricsData.length,
            })
        )
    })

    it('should handle errors when metrics generation fails', async () => {
        // Mock error
        const mockError = new Error('Failed to generate metrics')
        ;(Metrics.getMetrics as jest.Mock).mockRejectedValue(mockError)

        // Get the registered handler function
        const handlerFn = mockGetHandler.mock.calls[0][1]

        // Call the handler
        await handlerFn(mockRequest, mockResponse)

        // Verify error handling
        expect(mockLogger.error).toHaveBeenCalledWith(
            'Error generating metrics',
            expect.objectContaining({
                error: mockError,
            })
        )
        expect(mockResponse.status).toHaveBeenCalledWith(500)
        expect(mockResponse.send).toHaveBeenCalledWith(
            'Error generating metrics'
        )
    })

    it('should use the application logger provided in constructor', () => {
        // Create a new logger
        const newLogger = new (jest.requireMock(
            '../utils/logger'
        ).AppLogger)() as AppLogger

        // Clear previous calls
        jest.clearAllMocks()

        // Create new controller with new logger
        new MetricsController(mockApp as Express, newLogger)

        // Verify the new logger was used
        expect(newLogger.debug).toHaveBeenCalledWith(
            'MetricsEndpoint initialized'
        )
    })
})
