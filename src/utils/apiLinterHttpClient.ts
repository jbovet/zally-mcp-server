import {
    CircuitBreaker,
    CircuitBreakerOptions,
} from '../circuitbreaker/circuitBreaker'
import { RetryOptions, RetryManager } from '../circuitbreaker/retry'
import { Rule, LinterResult, Violation } from '../models/apiLinter'
import {
    ApiLinterServerApiError,
    ApiLinterServerAuthError,
    ApiLinterServerNetworkError,
} from './errors'
import axios, { AxiosError, AxiosRequestConfig } from 'axios'
import { AppLogger } from './logger'

/**
 * Configuration options for the ApiLinterHTTPClient
 */
export interface ApiLinterClientOptions {
    baseUrl: string
    timeout?: number
    retryOptions?: Partial<RetryOptions>
    circuitBreakerOptions?: Partial<CircuitBreakerOptions>
    logger?: AppLogger
}

/**
 * Client for making HTTP requests to the ApiLinterServer API.
 * Handles authentication, error handling, and response parsing.
 * Includes retry and circuit breaker patterns for resilience.
 */
export class ApiLinterHTTPClient {
    private apiLinterUrl: string
    private retryManager: RetryManager
    private circuitBreaker: CircuitBreaker
    private requestConfig: AxiosRequestConfig
    private logger?: AppLogger

    /**
     * Creates a new ApiLinterServer HTTP client.
     * @param apiLinterUrl - The base URL of the ApiLinterServer instance
     * @param options - Configuration options
     */
    constructor(
        apiLinterUrl: string,
        options: Partial<ApiLinterClientOptions> = {}
    ) {
        this.apiLinterUrl = apiLinterUrl
        this.retryManager = new RetryManager(options.retryOptions)
        this.circuitBreaker = new CircuitBreaker(options.circuitBreakerOptions)
        this.requestConfig = {
            timeout: options.timeout || 10000, // 10 seconds default timeout
        }
        this.logger = options.logger
    }

    /**
     * Lists all available rules from the API with resilience features
     * @returns Promise with an array of Rules
     */
    async listRules(isActive?: boolean): Promise<Rule[]> {
        this.logger?.debug('Listing API linting rules', { isActive })

        try {
            return await this.circuitBreaker.execute(
                async () =>
                    this.retryManager.executeWithRetry(async () => {
                        this.logger?.debug(
                            `Making request to ${this.apiLinterUrl}/supported-rules`
                        )

                        const response = await axios.get(
                            `${this.apiLinterUrl}/supported-rules?isActive=${isActive}`,
                            this.requestConfig
                        )

                        let rules: Rule[] = []
                        // Check if response.data has a rules property and it's an array
                        if (
                            response.data &&
                            response.data.rules &&
                            Array.isArray(response.data.rules)
                        ) {
                            // Access the rules array properly
                            rules = response.data.rules.map((rule: any) => ({
                                ...rule,
                                isActive: rule.is_active,
                                wmRuleId: rule.wm_rule_id,
                            }))
                        }

                        this.logger?.debug(`Retrieved ${rules.length} rules`)
                        return rules
                    }, 'listRules'),
                'listRules'
            )
        } catch (error) {
            this.logger?.error('Error listing rules', { error })
            this.handleError(error, 'listing rules')
        }
    }

    /**
     * Validates an API specification against configured linting rules with resilience features
     * @param specContent - The API specification content (OpenAPI/Swagger JSON or YAML)
     * @param activeRuleIds - Optional array of rule IDs to validate against (if not provided, all active rules are used)
     * @returns Promise with validation results containing any issues found
     */
    async validateSpec(
        specContent: string,
        activeRuleIds?: string[]
    ): Promise<LinterResult> {
        this.logger?.debug('Validating API specification', {
            specLength: specContent.length,
            activeRuleIdsCount: activeRuleIds?.length,
        })

        try {
            return await this.circuitBreaker.execute(
                async () =>
                    this.retryManager.executeWithRetry(async () => {
                        this.logger?.debug(
                            `Making request to ${this.apiLinterUrl}/api-violations`
                        )

                        const response = await axios.post(
                            `${this.apiLinterUrl}/api-violations`,
                            {
                                api_definition_string: specContent,
                                //ignore_rules: activeRuleIds || [],
                            },
                            {
                                ...this.requestConfig,
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                            }
                        )

                        const result = this.transformValidationResponse(
                            response.data
                        )
                        this.logger?.debug('API validation completed', {
                            violationsCount: result.violations.length,
                        })

                        return result
                    }, 'validateSpec'),
                'validateSpec'
            )
        } catch (error) {
            this.logger?.error('Error validating API specification', { error })
            this.handleError(error, 'validating specification')
        }
    }

    /**
     * Transforms the raw validation response from the API into a structured LinterResult
     * @param data - The raw response data from the API
     * @returns A structured LinterResult object
     */
    private transformValidationResponse(data: any): LinterResult {
        // Initialize violations array
        const violations: Violation[] = []

        // Initialize violations count map
        const violationsCount = new Map<string, number>()

        // Check if data contains violations
        if (data && Array.isArray(data.violations)) {
            // Transform each violation
            data.violations.forEach((violation: any) => {
                const transformedViolation: Violation = {
                    title: violation.title || 'Unnamed Violation',
                    description: violation.description || '',
                    violation_type: violation.violation_type || 'unknown',
                    rule_link: violation.rule_link || '',
                    paths: Array.isArray(violation.paths)
                        ? violation.paths
                        : [],
                }

                // Add optional line information if available
                if (violation.start_line !== undefined) {
                    transformedViolation.startLine = violation.start_line
                }

                if (violation.end_line !== undefined) {
                    transformedViolation.endLine = violation.end_line
                }

                violations.push(transformedViolation)

                // Update violations count
                const type = transformedViolation.violation_type
                violationsCount.set(type, (violationsCount.get(type) || 0) + 1)
            })
        }

        // Construct and return the LinterResult
        return {
            external_id: data.external_id || '',
            message: data.message || 'API validation completed',
            violations,
            violations_count: violationsCount,
        }
    }

    /**
     * Handle errors thrown during API operations and convert to appropriate error types
     * @param error The caught error
     * @param operation Description of the operation being performed
     * @throws Appropriate ApiLinter error
     */
    private handleError(error: unknown, operation: string): never {
        if (error instanceof AxiosError) {
            if (error.response?.status === 401) {
                throw new ApiLinterServerAuthError(
                    `Authentication failed when ${operation}`
                )
            }
            if (error.response?.status === 400) {
                throw new ApiLinterServerApiError(
                    `Invalid format: ${error.message}`
                )
            }
            throw new ApiLinterServerApiError(
                `Failed to ${operation}: ${error.message}`
            )
        }

        // If it's an error from our circuit breaker, wrap it
        if (
            error instanceof Error &&
            error.message.includes('Circuit breaker')
        ) {
            throw new ApiLinterServerNetworkError(
                `Service unavailable when ${operation}: ${error.message}`
            )
        }

        throw new ApiLinterServerNetworkError(
            `Network error when ${operation}: ${error}`
        )
    }
}
