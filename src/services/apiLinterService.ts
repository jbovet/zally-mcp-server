import { LinterResult, Rule, Violation } from '../models/apiLinter'
import { ApiLinterRepository } from '../repositories/apiLinterRepository'
import { AppLogger } from '../utils/logger'

/**
 * Service that provides business logic for ApiLinterServer operations.
 * Handles data formatting and communicates with the ApiLinterServer repository.
 */
export class ApiLinterService {
    private apiLinterRepository: ApiLinterRepository
    private logger: AppLogger

    /**
     * Creates a new ApiLinterServer service.
     * @param apiLinterRepository - The repository to use for ApiLinterServer API calls
     * @param logger - The application logger
     */
    constructor(apiLinterRepository: ApiLinterRepository, logger: AppLogger) {
        this.apiLinterRepository = apiLinterRepository
        this.logger = logger
        this.logger.debug('ApiLinterService initialized')
    }

    /**
     * Validates an API specification against all active linting rules
     * @param specContent - The API specification content (OpenAPI/Swagger JSON or YAML)
     * @returns Promise with validation results containing any issues found
     */
    async validateSpecification(specContent: string): Promise<LinterResult> {
        this.logger.info('Validating API specification against active rules')
        this.logger.debug('Specification length', {
            length: specContent.length,
        })

        try {
            // Attempt to detect the OpenAPI version from the content
            const openApiVersion = this.detectOpenApiVersion(specContent)
            this.logger.debug('Detected OpenAPI version', { openApiVersion })

            const result =
                await this.apiLinterRepository.validateSpecificationWithActiveRules(
                    specContent
                )

            // Log violation summary by type
            const violationSummary: Record<string, number> = {}
            result.violations_count.forEach((count, type) => {
                violationSummary[type] = count
            })

            this.logger.info('API validation completed successfully', {
                violationsCount: result.violations.length,
                violationsByType: violationSummary,
                externalId: result.external_id,
            })

            return result
        } catch (error) {
            this.logger.error('Error validating API specification', {
                error,
                stack: error instanceof Error ? error.stack : undefined,
            })
            throw error
        }
    }

    /**
     * Validates an API specification against specified linting rules
     * @param specContent - The API specification content (OpenAPI/Swagger JSON or YAML)
     * @param ruleIds - Array of rule IDs to validate against
     * @returns Promise with validation results containing any issues found
     */
    async validateSpecificationWithRules(
        specContent: string,
        ruleIds: string[]
    ): Promise<LinterResult> {
        this.logger.info(
            'Validating API specification against specified rules',
            {
                ruleCount: ruleIds.length,
            }
        )

        this.logger.debug('Validation details', {
            specLength: specContent.length,
            ruleIds,
        })

        try {
            const result = await this.apiLinterRepository.validateSpecification(
                specContent,
                ruleIds
            )

            // Log areas with most violations
            const pathViolations = this.analyzeViolationPaths(result.violations)

            this.logger.info(
                'API validation with rules completed successfully',
                {
                    violationsCount: result.violations.length,
                    topViolationPaths: pathViolations.slice(0, 3), // Top 3 paths with violations
                    externalId: result.external_id,
                }
            )

            return result
        } catch (error) {
            this.logger.error('Error validating API specification with rules', {
                error,
                ruleCount: ruleIds.length,
                stack: error instanceof Error ? error.stack : undefined,
            })
            throw error
        }
    }

    /**
     * Gets all available linting rules
     * @param isActive - Whether to filter for active rules only
     * @returns Promise with an array of Rules
     */
    async getLintingRules(): Promise<Rule[]> {
        this.logger.info('Getting linting rules')

        try {
            const rules = await this.apiLinterRepository.getRules(true)

            // Group rules by type for better insights
            const rulesByType: Record<string, number> = {}
            rules.forEach((rule) => {
                rulesByType[rule.type] = (rulesByType[rule.type] || 0) + 1
            })

            this.logger.info('Retrieved linting rules successfully', {
                count: rules.length,
                rulesByType,
            })

            return rules
        } catch (error) {
            this.logger.error('Error getting linting rules', {
                error,
                stack: error instanceof Error ? error.stack : undefined,
            })
            throw error
        }
    }

    /**
     * Formats validation results for display
     * @param results - The validation results to format
     * @returns Formatted validation results as a string
     */
    formatLinterResults(results: LinterResult): string {
        this.logger.debug('Formatting linter results', {
            violationsCount: results.violations.length,
        })

        // Check if there are no violations
        if (results.violations.length === 0) {
            this.logger.debug('No violations found in results')
            return '✅ API Specification is valid! No issues found.'
        }

        // Start with a header showing the total number of issues
        let output = `❌ Found ${results.violations.length} issues in API specification:\n\n`

        // Group violations by type
        const mustViolations = results.violations.filter(
            (v) => v.violation_type === 'MUST'
        )
        const shouldViolations = results.violations.filter(
            (v) => v.violation_type === 'SHOULD'
        )
        const mayViolations = results.violations.filter(
            (v) => v.violation_type === 'MAY'
        )
        const hintViolations = results.violations.filter(
            (v) => v.violation_type === 'HINT'
        )

        this.logger.debug('Violations grouped by type', {
            mustCount: mustViolations.length,
            shouldCount: shouldViolations.length,
            mayCount: mayViolations.length,
            hintCount: hintViolations.length,
        })

        // Add MUST violations (critical errors) count and details
        if (mustViolations.length > 0) {
            output += `🔴 ${mustViolations.length} MUST violation${mustViolations.length > 1 ? 's' : ''}\n`
            mustViolations.forEach((violation, index) => {
                output += this.formatViolation(violation, index + 1)
            })
            output += '\n'
        }

        // Add SHOULD violations (warnings) count and details
        if (shouldViolations.length > 0) {
            output += `🟠 ${shouldViolations.length} SHOULD violation${shouldViolations.length > 1 ? 's' : ''}\n`
            shouldViolations.forEach((violation, index) => {
                output += this.formatViolation(violation, index + 1)
            })
            output += '\n'
        }

        // Add MAY violations (suggestions) count and details
        if (mayViolations.length > 0) {
            output += `🟡 ${mayViolations.length} MAY violation${mayViolations.length > 1 ? 's' : ''}\n`
            mayViolations.forEach((violation, index) => {
                output += this.formatViolation(violation, index + 1)
            })
            output += '\n'
        }

        // Add HINT violations (info) count and details
        if (hintViolations.length > 0) {
            output += `🔵 ${hintViolations.length} HINT${hintViolations.length > 1 ? 's' : ''}\n`
            hintViolations.forEach((violation, index) => {
                output += this.formatViolation(violation, index + 1)
            })
        }

        // Add timestamp
        output += `\nValidation timestamp: ${new Date().toISOString()}`

        this.logger.debug('Formatted results generated', {
            resultLength: output.length,
        })
        return output
    }

    /**
     * Formats a violation for display
     * @param violation - The violation to format
     * @param index - The violation number for display
     * @returns Formatted violation as a string
     */
    private formatViolation(violation: Violation, index: number): string {
        let location = ''

        if (violation.paths && violation.paths.length > 0) {
            location = `at ${violation.paths[0]}`
        } else if (violation.startLine) {
            location = `at line ${violation.startLine}${violation.endLine ? `-${violation.endLine}` : ''}`
        }

        return `  ${index}. [${violation.title}] ${violation.description} ${location}\n`
    }

    /**
     * Analyze violation paths to identify which parts of the API have the most issues
     * @param violations - Array of violations from validation results
     * @returns Array of paths with violation counts, sorted by count
     */
    private analyzeViolationPaths(
        violations: Violation[]
    ): Array<{ path: string; count: number }> {
        // Create a map to count violations by path
        const pathCountMap: Record<string, number> = {}

        // Increment count for each path
        violations.forEach((violation) => {
            if (violation.paths && violation.paths.length > 0) {
                violation.paths.forEach((path) => {
                    pathCountMap[path] = (pathCountMap[path] || 0) + 1
                })
            }
        })

        // Convert map to array of objects
        const pathCounts = Object.entries(pathCountMap).map(
            ([path, count]) => ({
                path,
                count,
            })
        )

        // Sort by count (descending)
        return pathCounts.sort((a, b) => b.count - a.count)
    }

    /**
     * Attempts to detect OpenAPI version from specification content
     * @param specContent - The API specification content
     * @returns Detected version string or 'unknown'
     */
    private detectOpenApiVersion(specContent: string): string {
        try {
            // Check if content is JSON
            if (specContent.trim().startsWith('{')) {
                const parsed = JSON.parse(specContent)

                // Check for OpenAPI 3.x
                if (parsed.openapi) {
                    return parsed.openapi
                }

                // Check for Swagger 2.0
                if (parsed.swagger) {
                    return parsed.swagger
                }
            }
            // Check if content is YAML
            else {
                // Simple regex check for YAML format openapi or swagger version
                const openapiMatch = specContent.match(
                    /openapi:\s*['"]?(\d+\.\d+\.?\d*)['"]?/i
                )
                if (openapiMatch && openapiMatch[1]) {
                    return openapiMatch[1]
                }

                const swaggerMatch = specContent.match(
                    /swagger:\s*['"]?(\d+\.\d+\.?\d*)['"]?/i
                )
                if (swaggerMatch && swaggerMatch[1]) {
                    return swaggerMatch[1]
                }
            }
        } catch (error) {
            this.logger.debug('Error detecting OpenAPI version', { error })
        }

        return 'unknown'
    }
}
