import { getLogger } from '../utils/logger'

/**
 * Configuration options for the RetryManager
 */
export interface RetryOptions {
    // Maximum number of retry attempts
    maxRetries: number
    // Initial delay (milliseconds) between retries
    initialDelayMs: number
    // Maximum delay (milliseconds) between retries
    maxDelayMs: number
    // Factor by which to increase the delay on each retry (for exponential backoff)
    backoffFactor: number
    // If true, adds jitter to retry delays to prevent thundering herd problem
    jitter: boolean
}

const DEFAULT_OPTIONS: RetryOptions = {
    maxRetries: 3,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    backoffFactor: 2,
    jitter: true,
}

/**
 * Manages retry attempts with exponential backoff for failed operations
 */
export class RetryManager {
    private options: RetryOptions
    private logger = getLogger()

    /**
     * Creates a new RetryManager
     * @param options RetryManager configuration options
     */
    constructor(options?: Partial<RetryOptions>) {
        this.options = { ...DEFAULT_OPTIONS, ...options }
        this.logger.debug('RetryManager initialized', { options: this.options })
    }

    /**
     * Executes a function with retry logic
     * @param fn The function to execute and potentially retry
     * @param context Optional context name for logging
     * @returns The result of the function if successful
     * @throws The last error encountered if all retries fail
     */
    async executeWithRetry<T>(
        fn: () => Promise<T>,
        context?: string
    ): Promise<T> {
        const operationName = context || 'operation'
        let lastError: any = null

        // Try the initial attempt plus retries
        for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
            try {
                // If not the first attempt, delay before retrying
                if (attempt > 0) {
                    const delayMs = this.calculateDelay(attempt)
                    this.logger.debug(
                        `RetryManager: Waiting ${delayMs}ms before retry`,
                        {
                            operationName,
                            attempt,
                            maxRetries: this.options.maxRetries,
                        }
                    )
                    await this.delay(delayMs)
                }

                // Attempt the operation
                this.logger.debug(`RetryManager: Attempting ${operationName}`, {
                    attempt: attempt + 1,
                    maxAttempts: this.options.maxRetries + 1,
                })

                const result = await fn()

                // If successful, log and return the result
                if (attempt > 0) {
                    this.logger.info(
                        `RetryManager: Operation ${operationName} succeeded after ${attempt + 1} attempts`
                    )
                }

                return result
            } catch (error) {
                lastError = error
                this.logger.warn(
                    `RetryManager: Operation ${operationName} failed on attempt ${attempt + 1}/${this.options.maxRetries + 1}`,
                    {
                        error: error instanceof Error ? error.message : error,
                        stack: error instanceof Error ? error.stack : undefined,
                    }
                )

                // On the last attempt, don't retry
                if (attempt >= this.options.maxRetries) {
                    this.logger.error(
                        `RetryManager: Operation ${operationName} failed after ${this.options.maxRetries + 1} attempts`
                    )
                    throw lastError
                }
            }
        }

        // This should never be reached due to the throw in the loop,
        // but TypeScript needs it for type safety
        throw lastError
    }

    /**
     * Calculate the delay time for a retry attempt using exponential backoff
     * @param attempt The current retry attempt (starts at 1)
     * @returns Delay in milliseconds
     */
    private calculateDelay(attempt: number): number {
        // Calculate exponential backoff
        let delay =
            this.options.initialDelayMs *
            Math.pow(this.options.backoffFactor, attempt - 1)

        // Cap at maximum delay
        delay = Math.min(delay, this.options.maxDelayMs)

        // Add jitter to prevent thundering herd problem
        if (this.options.jitter) {
            // Add up to 25% random jitter
            const jitterFactor = 0.75 + Math.random() * 0.5
            delay = Math.floor(delay * jitterFactor)
        }

        return delay
    }

    /**
     * Create a delay for the specified milliseconds
     * @param ms Milliseconds to delay
     * @returns Promise that resolves after the delay
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}
