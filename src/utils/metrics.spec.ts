import { Metrics } from './metrics'
import client from 'prom-client'

jest.mock('prom-client', () => {
    // Create mock implementations for each Prometheus class
    const mockCounter = {
        inc: jest.fn(),
    }

    const mockGauge = {
        set: jest.fn(),
    }

    const mockHistogram = {
        observe: jest.fn(),
    }

    const mockRegistry = {
        metrics: jest.fn().mockResolvedValue('mock metrics data'),
        registerMetric: jest.fn(),
        clear: jest.fn(),
    }

    return {
        Counter: jest.fn().mockImplementation(() => mockCounter),
        Gauge: jest.fn().mockImplementation(() => mockGauge),
        Histogram: jest.fn().mockImplementation(() => mockHistogram),
        Registry: jest.fn().mockImplementation(() => mockRegistry),
        collectDefaultMetrics: jest.fn(),
        default: {
            Counter: jest.fn().mockImplementation(() => mockCounter),
            Gauge: jest.fn().mockImplementation(() => mockGauge),
            Histogram: jest.fn().mockImplementation(() => mockHistogram),
            Registry: jest.fn().mockImplementation(() => mockRegistry),
            collectDefaultMetrics: jest.fn(),
        },
    }
})

describe('Metrics', () => {
    let mockCounter: any
    let mockGauge: any
    let mockHistogram: any
    let mockRegistry: any

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks()

        // Get references to the mock instances
        mockCounter = new (client.Counter as jest.Mock)()
        mockGauge = new (client.Gauge as jest.Mock)()
        mockHistogram = new (client.Histogram as jest.Mock)()
        mockRegistry = new (client.Registry as unknown as jest.Mock)()
    })

    describe('getMetrics', () => {
        it('should return the registered metrics in Prometheus format', async () => {
            const metrics = await Metrics.getMetrics()

            expect(metrics).toBe('mock metrics data')
        })
    })

    describe('resetMetrics', () => {
        it('should clear the registry and re-register default metrics', async () => {
            await Metrics.resetMetrics()

            expect(mockRegistry.clear).toHaveBeenCalled()
            expect(client.collectDefaultMetrics).toHaveBeenCalledWith({
                register: mockRegistry,
            })
        })
    })

    describe('recordHttpRequest', () => {
        it('should increment the HTTP request counter and observe request duration', () => {
            const method = 'GET'
            const route = '/test'
            const statusCode = 200
            const durationMs = 150

            Metrics.recordHttpRequest(method, route, statusCode, durationMs)

            expect(mockCounter.inc).toHaveBeenCalledWith({
                method,
                route,
                status_code: statusCode,
            })

            expect(mockHistogram.observe).toHaveBeenCalledWith(
                { method, route, status_code: statusCode },
                durationMs / 1000
            )
        })
    })

    describe('recordError', () => {
        it('should increment the error counter with the appropriate type', () => {
            const errorTypes: ('client' | 'server' | 'network')[] = [
                'client',
                'server',
                'network',
            ]

            errorTypes.forEach((type) => {
                Metrics.recordError(type)
                expect(mockCounter.inc).toHaveBeenCalledWith({ type })
            })

            // Verify the counter was called once for each error type
            expect(mockCounter.inc).toHaveBeenCalledTimes(3)
        })
    })

    describe('recordMcpTool', () => {
        it('should record tool invocation metrics with status code and duration', () => {
            const tool = 'test-tool'
            const status = 'success'
            const durationMs = 150

            Metrics.recordMcpTool(tool, status, durationMs)

            expect(mockCounter.inc).toHaveBeenCalledWith({
                tool,
                status: status,
            })

            expect(mockHistogram.observe).toHaveBeenCalledWith(
                { tool, status: status },
                durationMs / 1000
            )
        })
    })

    describe('updateMcpResourceCount', () => {
        it('should set the resource count gauge with type, status, and count', () => {
            const type = 'tool'
            const status = 'available'
            const count = 3

            Metrics.updateMcpResourceCount(type, status, count)

            expect(mockGauge.set).toHaveBeenCalledWith({ type, status }, count)
        })
    })

    describe('incrementMcpToolInvocation', () => {
        it('should increment the tool invocation counter with tool name and status', () => {
            const tool = 'test-tool'
            const statuses: ('success' | 'failure')[] = ['success', 'failure']

            statuses.forEach((status) => {
                Metrics.incrementMcpToolInvocation(tool, status)
                expect(mockCounter.inc).toHaveBeenCalledWith({ tool, status })
            })

            expect(mockCounter.inc).toHaveBeenCalledTimes(2)
        })
    })

    describe('recordMcpToolDuration', () => {
        it('should record tool execution duration with tool name and status', () => {
            const tool = 'test-tool'
            const status = 'success'
            const durationMs = 150

            Metrics.recordMcpToolDuration(tool, status, durationMs)

            expect(mockHistogram.observe).toHaveBeenCalledWith(
                { tool, status },
                durationMs / 1000
            )
        })

        it('should record failure status correctly', () => {
            const tool = 'test-tool'
            const status = 'failure'
            const durationMs = 150

            Metrics.recordMcpToolDuration(tool, status, durationMs)

            expect(mockHistogram.observe).toHaveBeenCalledWith(
                { tool, status },
                durationMs / 1000
            )
        })
    })
})
