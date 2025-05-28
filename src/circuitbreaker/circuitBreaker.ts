import { getLogger } from '../utils/logger'

/**
 * States for the Circuit Breaker
 */
export enum CircuitBreakerState {
    CLOSED = 'CLOSED', // Normal operation - requests allowed
    OPEN = 'OPEN', // Failing - requests blocked
    HALF_OPEN = 'HALF_OPEN', // Trial - testing if service has recovered
}

/**
 * Configuration options for CircuitBreaker
 */
export interface CircuitBreakerOptions {
    // How many failures before opening the circuit
    failureThreshold: number
    // How long to wait (milliseconds) before allowing a trial request
    resetTimeout: number
    // Optional name for logging
    name?: string
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
    failureThreshold: 5,
    resetTimeout: 30000, // 30 seconds
    name: 'default',
}

/**
 * Implements the circuit breaker pattern for handling transient service failures
 * and preventing cascading failures when a service is unhealthy.
 */
export class CircuitBreaker {
    private state: CircuitBreakerState = CircuitBreakerState.CLOSED
    private failureCount: number = 0
    private nextAttempt: number = Date.now()
    private options: CircuitBreakerOptions
    private circuitResetTimeout?: NodeJS.Timeout
    private logger = getLogger()

    /**
     * Creates a new CircuitBreaker instance
     * @param options CircuitBreaker configuration options
     */
    constructor(options?: Partial<CircuitBreakerOptions>) {
        this.options = { ...DEFAULT_OPTIONS, ...options }
        this.logger.debug(`CircuitBreaker [${this.options.name}] initialized`, {
            state: this.state,
            options: this.options,
        })
    }

    /**
     * Executes a function with circuit breaker protection
     * @param fn The function to execute
     * @param context Optional context name for logging
     * @returns The result of the function
     * @throws Error if the circuit is open or the function throws an error
     */
    async execute<T>(fn: () => Promise<T>, context?: string): Promise<T> {
        const operationName = context || 'operation'

        // Check if the circuit is open
        if (this.state === CircuitBreakerState.OPEN) {
            this.logger.debug(`CircuitBreaker [${this.options.name}] is OPEN`, {
                operationName,
                nextAttempt: new Date(this.nextAttempt),
            })

            if (Date.now() < this.nextAttempt) {
                // Circuit is open and reset timeout hasn't elapsed
                throw new Error(
                    `Circuit breaker [${this.options.name}] is open`
                )
            }

            // Time to try a test request - transition to half-open
            this.transitionToState(CircuitBreakerState.HALF_OPEN)
        }

        try {
            // Execute the function
            const result = await fn()

            // Success - reset the circuit if it was half-open
            if (this.state === CircuitBreakerState.HALF_OPEN) {
                this.reset()
            }

            return result
        } catch (error) {
            // Handle failure
            this.recordFailure(operationName, error)
            throw error
        }
    }

    /**
     * Records a failure and potentially opens the circuit
     * @param operationName Name of the operation that failed
     * @param error The error that occurred
     */
    private recordFailure(operationName: string, error: any): void {
        this.failureCount++

        this.logger.warn(
            `CircuitBreaker [${this.options.name}] operation failed`,
            {
                operationName,
                failureCount: this.failureCount,
                state: this.state,
                error: error instanceof Error ? error.message : error,
            }
        )

        if (this.state === CircuitBreakerState.HALF_OPEN) {
            // In half-open state, a single failure reopens the circuit
            this.transitionToState(CircuitBreakerState.OPEN)
        } else if (this.failureCount >= this.options.failureThreshold) {
            // Too many failures, open the circuit
            this.transitionToState(CircuitBreakerState.OPEN)
        }
    }

    /**
     * Changes the circuit state and handles related logic
     * @param newState The state to transition to
     */
    private transitionToState(newState: CircuitBreakerState): void {
        if (newState === this.state) return

        const oldState = this.state
        this.state = newState

        this.logger.info(
            `CircuitBreaker [${this.options.name}] state changed: ${oldState} -> ${newState}`
        )

        if (newState === CircuitBreakerState.OPEN) {
            // Set next attempt time
            this.nextAttempt = Date.now() + this.options.resetTimeout

            // Clear any existing timeout
            if (this.circuitResetTimeout) {
                clearTimeout(this.circuitResetTimeout)
            }

            // Schedule transition to half-open
            this.circuitResetTimeout = setTimeout(() => {
                this.logger.info(
                    `CircuitBreaker [${this.options.name}] reset timeout elapsed, transitioning to HALF_OPEN`
                )
                this.transitionToState(CircuitBreakerState.HALF_OPEN)
            }, this.options.resetTimeout)
        }
    }

    /**
     * Resets the circuit to closed state
     */
    private reset(): void {
        this.failureCount = 0
        this.transitionToState(CircuitBreakerState.CLOSED)

        // Clear any scheduled state change
        if (this.circuitResetTimeout) {
            clearTimeout(this.circuitResetTimeout)
            this.circuitResetTimeout = undefined
        }

        this.logger.info(
            `CircuitBreaker [${this.options.name}] reset to CLOSED state`
        )
    }

    /**
     * Get the current state of the circuit breaker
     */
    getState(): CircuitBreakerState {
        return this.state
    }

    /**
     * Get the current failure count
     */
    getFailureCount(): number {
        return this.failureCount
    }
}
