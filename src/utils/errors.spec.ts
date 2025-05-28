import {
    ApLinterServerError,
    ApiLinterServerAuthError,
    ApiLinterServerApiError,
    ApiLinterServerNetworkError,
} from './errors'

describe('ApiLinterServer Error Classes', () => {
    describe('ApLinterServerError', () => {
        it('should initialize with the provided message', () => {
            const errorMessage = 'Test error message'

            const error = new ApLinterServerError(errorMessage)

            expect(error.message).toBe(errorMessage)
            expect(error.name).toBe('ApLinterServerError')
        })

        it('should store statusCode when provided', () => {
            const errorMessage = 'Test error message'
            const statusCode = 500

            const error = new ApLinterServerError(errorMessage, statusCode)

            expect(error.statusCode).toBe(statusCode)
        })

        it('should store response data when provided', () => {
            const errorMessage = 'Test error message'
            const statusCode = 500
            const responseData = { errors: ['Something went wrong'] }

            const error = new ApLinterServerError(
                errorMessage,
                statusCode,
                responseData
            )

            expect(error.response).toBe(responseData)
        })

        it('should have undefined statusCode and response when not provided', () => {
            const errorMessage = 'Test error message'

            const error = new ApLinterServerError(errorMessage)

            expect(error.statusCode).toBeUndefined()
            expect(error.response).toBeUndefined()
        })

        it('should be instance of Error', () => {
            const error = new ApLinterServerError('Test error message')

            expect(error).toBeInstanceOf(Error)
        })
    })

    describe('ApiLinterServerAuthError', () => {
        it('should initialize with the provided message', () => {
            const errorMessage = 'Authentication test error'

            const error = new ApiLinterServerAuthError(errorMessage)

            expect(error.message).toBe(errorMessage)
            expect(error.name).toBe('ApiLinterServerAuthError')
        })

        it('should store statusCode when provided', () => {
            const errorMessage = 'Authentication test error'
            const statusCode = 401

            const error = new ApiLinterServerAuthError(errorMessage, statusCode)

            expect(error.statusCode).toBe(statusCode)
        })

        it('should store response data when provided', () => {
            const errorMessage = 'Authentication test error'
            const statusCode = 403
            const responseData = { errors: ['Forbidden'] }

            const error = new ApiLinterServerAuthError(
                errorMessage,
                statusCode,
                responseData
            )

            expect(error.response).toBe(responseData)
        })

        it('should be instance of ApLinterServerError', () => {
            const error = new ApiLinterServerAuthError(
                'Authentication test error'
            )

            expect(error).toBeInstanceOf(ApLinterServerError)
        })

        it('should be instance of Error', () => {
            const error = new ApiLinterServerAuthError(
                'Authentication test error'
            )

            expect(error).toBeInstanceOf(Error)
        })
    })

    describe('ApiLinterServerApiError', () => {
        it('should initialize with the provided message', () => {
            const errorMessage = 'API test error'

            const error = new ApiLinterServerApiError(errorMessage)

            expect(error.message).toBe(errorMessage)
            expect(error.name).toBe('ApiLinterServerApiError')
        })

        it('should store statusCode when provided', () => {
            const errorMessage = 'API test error'
            const statusCode = 400

            const error = new ApiLinterServerApiError(errorMessage, statusCode)

            expect(error.statusCode).toBe(statusCode)
        })

        it('should store response data when provided', () => {
            const errorMessage = 'API test error'
            const statusCode = 422
            const responseData = { errors: ['Validation failed'] }

            const error = new ApiLinterServerApiError(
                errorMessage,
                statusCode,
                responseData
            )

            expect(error.response).toBe(responseData)
        })

        it('should be instance of ApLinterServerError', () => {
            const error = new ApiLinterServerApiError('API test error')

            expect(error).toBeInstanceOf(ApLinterServerError)
        })

        it('should be instance of Error', () => {
            const error = new ApiLinterServerApiError('API test error')

            expect(error).toBeInstanceOf(Error)
        })
    })

    describe('ApiLinterServerNetworkError', () => {
        it('should initialize with the provided message', () => {
            const errorMessage = 'Network test error'

            const error = new ApiLinterServerNetworkError(errorMessage)

            expect(error.message).toBe(errorMessage)
            expect(error.name).toBe('ApiLinterServerNetworkError')
        })

        it('should have undefined statusCode and response', () => {
            const errorMessage = 'Network test error'

            const error = new ApiLinterServerNetworkError(errorMessage)

            expect(error.statusCode).toBeUndefined()
            expect(error.response).toBeUndefined()
        })

        it('should be instance of ApLinterServerError', () => {
            const error = new ApiLinterServerNetworkError('Network test error')

            expect(error).toBeInstanceOf(ApLinterServerError)
        })

        it('should be instance of Error', () => {
            const error = new ApiLinterServerNetworkError('Network test error')

            expect(error).toBeInstanceOf(Error)
        })

        it('should not allow setting statusCode or response', () => {
            const errorMessage = 'Network test error'
            const statusCode = 0
            const responseData = { detail: 'should not be stored' }

            const error = new ApiLinterServerNetworkError(errorMessage)

            expect(error.statusCode).toBeUndefined()
            expect(error.response).toBeUndefined()
        })
    })

    describe('Error inheritance', () => {
        it('should maintain proper prototype chain', () => {
            const baseError = new ApLinterServerError('Base error')
            const authError = new ApiLinterServerAuthError('Auth error')
            const apiError = new ApiLinterServerApiError('API error')
            const networkError = new ApiLinterServerNetworkError(
                'Network error'
            )

            expect(Object.getPrototypeOf(baseError)).toBe(
                ApLinterServerError.prototype
            )
            expect(Object.getPrototypeOf(authError)).toBe(
                ApiLinterServerAuthError.prototype
            )
            expect(Object.getPrototypeOf(apiError)).toBe(
                ApiLinterServerApiError.prototype
            )
            expect(Object.getPrototypeOf(networkError)).toBe(
                ApiLinterServerNetworkError.prototype
            )

            expect(
                Object.getPrototypeOf(ApiLinterServerAuthError.prototype)
            ).toBe(ApLinterServerError.prototype)
            expect(
                Object.getPrototypeOf(ApiLinterServerApiError.prototype)
            ).toBe(ApLinterServerError.prototype)
            expect(
                Object.getPrototypeOf(ApiLinterServerNetworkError.prototype)
            ).toBe(ApLinterServerError.prototype)
            expect(Object.getPrototypeOf(ApLinterServerError.prototype)).toBe(
                Error.prototype
            )
        })

        it('should properly identify error types using instanceof', () => {
            const baseError = new ApLinterServerError('Base error')
            const authError = new ApiLinterServerAuthError('Auth error')
            const apiError = new ApiLinterServerApiError('API error')
            const networkError = new ApiLinterServerNetworkError(
                'Network error'
            )

            expect(authError instanceof ApiLinterServerAuthError).toBe(true)
            expect(authError instanceof ApLinterServerError).toBe(true)
            expect(authError instanceof Error).toBe(true)

            expect(apiError instanceof ApiLinterServerApiError).toBe(true)
            expect(apiError instanceof ApLinterServerError).toBe(true)
            expect(apiError instanceof Error).toBe(true)

            expect(networkError instanceof ApiLinterServerNetworkError).toBe(
                true
            )
            expect(networkError instanceof ApLinterServerError).toBe(true)
            expect(networkError instanceof Error).toBe(true)

            expect(baseError instanceof ApiLinterServerAuthError).toBe(false)
            expect(baseError instanceof ApiLinterServerApiError).toBe(false)
            expect(baseError instanceof ApiLinterServerNetworkError).toBe(false)

            expect(authError instanceof ApiLinterServerApiError).toBe(false)
            expect(authError instanceof ApiLinterServerNetworkError).toBe(false)

            expect(apiError instanceof ApiLinterServerAuthError).toBe(false)
            expect(apiError instanceof ApiLinterServerNetworkError).toBe(false)

            expect(networkError instanceof ApiLinterServerAuthError).toBe(false)
            expect(networkError instanceof ApiLinterServerApiError).toBe(false)
        })
    })
})
