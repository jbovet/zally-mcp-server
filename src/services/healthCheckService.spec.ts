import { HealthCheckService } from './healthCheckService'
import { ApiLinterService } from './apiLinterService'
import { AppLogger } from '../utils/logger'

describe('HealthCheckService', () => {
    let healthCheckService: HealthCheckService
    let mockApiLinterService: jest.Mocked<ApiLinterService>
    let mockLogger: jest.Mocked<AppLogger>

    beforeEach(() => {
        jest.clearAllMocks()

        // Mock ApiLinterService
        mockApiLinterService = {
            getLintingRules: jest.fn(),
            validateSpecification: jest.fn(),
            validateSpecificationWithRules: jest.fn(),
            formatLinterResults: jest.fn(),
        } as unknown as jest.Mocked<ApiLinterService>

        // Mock logger
        mockLogger = {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            http: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
        } as unknown as jest.Mocked<AppLogger>

        // Create service instance with mocks
        healthCheckService = new HealthCheckService(
            mockApiLinterService,
            mockLogger,
            { checkIntervalMs: 100 } // Use a short interval for testing
        )
    })

    describe('getHealth', () => {
        it('should return healthy status when API Linter is available', async () => {
            // Setup mock to return successfully
            mockApiLinterService.getLintingRules.mockResolvedValue([])

            // Force a check to ensure status is updated
            await healthCheckService.forceCheck()

            // Get health status
            const health = await healthCheckService.getHealth()

            // Verify status is ok
            expect(health.status).toBe('ok')
            expect(health.services.apiLinter.status).toBe('ok')
            expect(health.services.apiLinter.message).toContain('available')

            // Verify uptime and timestamps
            expect(health.uptime).toBeGreaterThanOrEqual(0)
            expect(new Date(health.timestamp)).toBeInstanceOf(Date)
            expect(
                new Date(health.services.apiLinter.lastChecked)
            ).toBeInstanceOf(Date)

            // Verify logging occurred
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'API Linter health check successful'
            )
        })

        it('should return unhealthy status when API Linter is unavailable', async () => {
            // Setup mock to throw an error
            const testError = new Error('Connection refused')
            mockApiLinterService.getLintingRules.mockRejectedValue(testError)

            // Force a check to ensure status is updated
            await healthCheckService.forceCheck()

            // Get health status
            const health = await healthCheckService.getHealth()

            // Verify status is unhealthy
            expect(health.status).toBe('unhealthy')
            expect(health.services.apiLinter.status).toBe('unhealthy')
            expect(health.services.apiLinter.message).toContain('unavailable')
            expect(health.services.apiLinter.message).toContain(
                'Connection refused'
            )

            // Verify logging occurred
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'API Linter health check failed',
                expect.objectContaining({
                    error: testError,
                    message: expect.stringContaining('Connection refused'),
                })
            )
        })

        it('should not check API Linter status if interval has not passed', async () => {
            // Setup initial successful check
            mockApiLinterService.getLintingRules.mockResolvedValue([])
            await healthCheckService.forceCheck()

            // Reset the mock to verify it's not called again
            mockApiLinterService.getLintingRules.mockClear()

            // Get health status immediately (before interval passes)
            await healthCheckService.getHealth()

            // Verify the getLintingRules method wasn't called again
            expect(mockApiLinterService.getLintingRules).not.toHaveBeenCalled()
        })

        it('should check API Linter status if interval has passed', async () => {
            // Setup initial successful check
            mockApiLinterService.getLintingRules.mockResolvedValue([])
            await healthCheckService.forceCheck()

            // Reset the mock to verify it's called again
            mockApiLinterService.getLintingRules.mockClear()

            // Wait for interval to pass
            await new Promise((resolve) => setTimeout(resolve, 150))

            // Get health status after interval
            await healthCheckService.getHealth()

            // Verify the getLintingRules method was called again
            expect(mockApiLinterService.getLintingRules).toHaveBeenCalled()
        })
    })

    describe('forceCheck', () => {
        it('should immediately check API Linter status', async () => {
            // Setup mock
            mockApiLinterService.getLintingRules.mockResolvedValue([])

            // Force check
            await healthCheckService.forceCheck()

            // Verify the getLintingRules method was called
            expect(mockApiLinterService.getLintingRules).toHaveBeenCalled()

            // Verify logging
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Checking API Linter service health'
            )
        })

        it('should handle errors during forced check', async () => {
            // Setup mock to throw
            const testError = new Error('Network error')
            mockApiLinterService.getLintingRules.mockRejectedValue(testError)

            // Force check
            await healthCheckService.forceCheck()

            // Verify error handling
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'API Linter health check failed',
                expect.objectContaining({
                    error: testError,
                })
            )

            // Get health to verify status was updated
            const health = await healthCheckService.getHealth()
            expect(health.status).toBe('unhealthy')
        })
    })
})
