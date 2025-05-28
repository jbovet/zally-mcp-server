/**
 * Base class for all ApiLinterServer-related errors.
 * Provides common properties for HTTP status code and response data.
 */
export class ApLinterServerError extends Error {
    statusCode?: number
    response?: any

    /**
     * Creates a new ApiLinterServer error.
     * @param message - The error message
     * @param statusCode - The HTTP status code, if applicable
     * @param response - The raw response data, if available
     */
    constructor(message: string, statusCode?: number, response?: any) {
        super(message)
        this.name = 'ApLinterServerError'
        this.statusCode = statusCode
        this.response = response
    }
}

/**
 * Error thrown when authentication fails with the ApiLinterServer API.
 * This typically indicates incorrect credentials or insufficient permissions.
 */
export class ApiLinterServerAuthError extends ApLinterServerError {
    /**
     * Creates a new ApiLinterServer authentication error.
     * @param message - The error message
     * @param statusCode - The HTTP status code (typically 401 or 403)
     * @param response - The raw response data, if available
     */
    constructor(message: string, statusCode?: number, response?: any) {
        super(message, statusCode, response)
        this.name = 'ApiLinterServerAuthError'
    }
}

/**
 * Error thrown when the ApiLinterServer API returns an error response.
 * This typically indicates invalid parameters or a server-side issue.
 */
export class ApiLinterServerApiError extends ApLinterServerError {
    /**
     * Creates a new ApiLinterServer API error.
     * @param message - The error message
     * @param statusCode - The HTTP status code
     * @param response - The raw response data, if available
     */
    constructor(message: string, statusCode?: number, response?: any) {
        super(message, statusCode, response)
        this.name = 'ApiLinterServerApiError'
    }
}

/**
 * Error thrown when network communication with ApiLinterServer fails.
 * This typically indicates connectivity issues or timeouts.
 */
export class ApiLinterServerNetworkError extends ApLinterServerError {
    /**
     * Creates a new ApiLinterServer network error.
     * @param message - The error message
     */
    constructor(message: string) {
        super(message)
        this.name = 'ApiLinterServerNetworkError'
    }
}
