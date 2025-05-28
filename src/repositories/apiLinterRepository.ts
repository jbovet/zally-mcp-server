import { LinterResult, Rule } from '../models/apiLinter'
import { ApiLinterHTTPClient } from '../utils/apiLinterHttpClient'
import { getLogger } from '../utils/logger'

/**
 * Repository that handles data access to the ApiLinterServer API.
 * Uses the ApiLinterHTTPClient to make API requests.
 */
export class ApiLinterRepository {
    private apiLinterClient: ApiLinterHTTPClient
    private logger = getLogger()

    /**
     * Creates a new ApiLinterServer repository.
     * @param apiLinterClient - The HTTP client to use for ApiLinterServer API calls
     */
    constructor(apiLinterClient: ApiLinterHTTPClient) {
        this.apiLinterClient = apiLinterClient
        this.logger.debug('ApiLinterRepository initialized')
    }

    /**
     * Gets all available rules from the API Linter server
     * @param isActive - Whether to filter for active rules only
     * @returns Promise with an array of Rules
     */
    async getRules(isActive: boolean): Promise<Rule[]> {
        this.logger.debug('Fetching rules from API Linter server', { isActive })

        try {
            const rules = await this.apiLinterClient.listRules(isActive)
            this.logger.debug('Successfully retrieved rules', {
                count: rules.length,
                isActive,
            })
            return rules
        } catch (error) {
            this.logger.error('Error fetching rules from API Linter server', {
                error,
                isActive,
                stack: error instanceof Error ? error.stack : undefined,
            })
            throw error
        }
    }

    /**
     * Validates an API specification against configured linting rules
     * @param specContent - The API specification content (OpenAPI/Swagger JSON or YAML)
     * @param activeRuleIds - Optional array of rule IDs to validate against (if not provided, all active rules are used)
     * @returns Promise with validation results containing any issues found
     */
    async validateSpecification(
        specContent: string,
        activeRuleIds?: string[]
    ): Promise<LinterResult> {
        this.logger.debug(
            'Validating specification against API Linter server',
            {
                specLength: specContent.length,
                ruleIdsCount: activeRuleIds?.length,
            }
        )

        try {
            const startTime = Date.now()

            const result = await this.apiLinterClient.validateSpec(
                specContent,
                activeRuleIds
            )

            const duration = Date.now() - startTime
            this.logger.debug('API Linter validation completed', {
                duration: `${duration}ms`,
                violationsCount: result.violations.length,
            })

            return result
        } catch (error) {
            this.logger.error(
                'Error validating specification with API Linter server',
                {
                    error,
                    ruleIdsCount: activeRuleIds?.length,
                    stack: error instanceof Error ? error.stack : undefined,
                }
            )
            throw error
        }
    }

    /**
     * Gets active rules and validates a specification against them
     * @param specContent - The API specification content (OpenAPI/Swagger JSON or YAML)
     * @returns Promise with validation results containing any issues found
     */
    async validateSpecificationWithActiveRules(
        specContent: string
    ): Promise<LinterResult> {
        this.logger.debug('Validating specification with active rules')

        try {
            // Get all rules
            this.logger.debug('Fetching active rules for validation')
            const rules = await this.getRules(true)

            // Filter active rules and extract their IDs
            const activeRuleIds = rules
                .filter((rule) => rule.isActive)
                .map((rule) => rule.wmRuleId)

            this.logger.debug('Filtered active rules for validation', {
                totalRules: rules.length,
                activeRuleCount: activeRuleIds.length,
            })

            // Validate with active rule IDs
            return this.validateSpecification(specContent, activeRuleIds)
        } catch (error) {
            this.logger.error('Error in validateSpecificationWithActiveRules', {
                error,
                stack: error instanceof Error ? error.stack : undefined,
            })
            throw error
        }
    }
}
