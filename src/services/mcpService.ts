import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { ApiLinterService } from './apiLinterService'
import { AppLogger } from '../utils/logger'
import { Metrics } from '../utils/metrics'

/**
 * Service that manages the Model Context Protocol server.
 * Registers tools and prompts for ApiLinterServer integration with MCP.
 */
export class McpService {
    private server: McpServer
    private apiLinterService: ApiLinterService
    private logger: AppLogger

    /**
     * Creates a new MCP service.
     * @param apiLinterService - The ApiLinterServer service to use for API calls
     * @param logger - The application logger
     */
    constructor(apiLinterService: ApiLinterService, logger: AppLogger) {
        this.apiLinterService = apiLinterService
        this.logger = logger

        this.logger.info('Initializing MCP server')
        this.server = new McpServer({
            name: 'ApiLinterServer-Integration',
            version: '1.0.0',
        })

        this.registerTools()
        this.registerPrompts()
        this.logger.info('MCP server initialized successfully')
    }

    /**
     * Gets the configured MCP server instance.
     * @returns The MCP server instance
     */
    getServer(): McpServer {
        return this.server
    }

    /**
     * Registers all MCP tools for API Linter integration.
     * Sets up tool definitions with parameters, descriptions and handlers for:
     * - API specification validation
     * - Rule listing functionality
     * @private
     */
    private registerTools() {
        this.logger.info('Registering MCP tools')

        // Register API validation tool
        this.logger.debug('Registering validate_api_specification tool')
        this.server.tool(
            'validate_api_specification',
            'Validates an API specification (OpenAPI/Swagger) against API Linter rules',
            {
                spec: z
                    .string()
                    .describe('API specification in JSON or YAML format'),
                ruleIds: z
                    .array(z.string())
                    .optional()
                    .describe('List of rule IDs to ignore during validation'),
            },
            /**
             * Handler for API specification validation
             * @param param0 Object containing the API spec and optional rule IDs to ignore
             * @param param0.spec The API specification string (JSON/YAML)
             * @param param0.ruleIds Optional array of rule IDs to ignore during validation
             * @returns Formatted validation results with issue count and details
             */
            async ({ spec, ruleIds }) => {
                const requestId = `val-${Date.now()}`
                const startTime = Date.now() // Start time for metrics

                this.logger.info(
                    'Handling validate_api_specification tool request',
                    {
                        requestId,
                        specLength: spec.length,
                        ruleIdsCount: ruleIds?.length,
                    }
                )

                try {
                    // Validate the specification
                    let results: any
                    if (ruleIds && ruleIds.length > 0) {
                        this.logger.debug('Validating with specific rule IDs', {
                            requestId,
                            ruleIds,
                        })
                        results =
                            await this.apiLinterService.validateSpecificationWithRules(
                                spec,
                                ruleIds
                            )
                    } else {
                        this.logger.debug('Validating with all active rules', {
                            requestId,
                        })
                        results =
                            await this.apiLinterService.validateSpecification(
                                spec
                            )
                    }

                    // Format the results
                    this.logger.debug('Formatting validation results', {
                        requestId,
                        violationsCount: results.violations.length,
                    })
                    const formattedResults =
                        this.apiLinterService.formatLinterResults(results)

                    this.logger.info('Validation completed successfully', {
                        requestId,
                        violationsCount: results.violations.length,
                    })

                    // Record metrics for successful tool invocation
                    const duration = Date.now() - startTime
                    Metrics.recordMcpTool(
                        'validate_api_specification',
                        'success',
                        duration
                    )

                    // Return the response in the expected format
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Validation completed. Found ${results.violations.length} issues.`,
                            },
                            {
                                type: 'text',
                                text: formattedResults,
                            },
                        ],
                    }
                } catch (error) {
                    // Record metrics for failed tool invocation
                    const duration = Date.now() - startTime
                    Metrics.recordMcpTool(
                        'validate_api_specification',
                        'failure',
                        duration
                    )

                    this.logger.error('Error validating API specification', {
                        requestId,
                        error,
                        stack: error instanceof Error ? error.stack : undefined,
                    })

                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Error validating specification: ${error instanceof Error ? error.message : String(error)}`,
                            },
                        ],
                        isError: true,
                    }
                }
            }
        )

        // Register list rules tool
        this.logger.debug('Registering list_rules tool')
        this.server.tool(
            'list_rules',
            'Lists all available API Linter rules',
            async () => {
                const requestId = `rules-${Date.now()}`
                const startTime = Date.now() // Start time for metrics

                this.logger.info('Handling list_rules tool request', {
                    requestId,
                })

                try {
                    // Fetch the rules
                    this.logger.debug(
                        'Fetching rules from API linter service',
                        {
                            requestId,
                        }
                    )
                    const rules = await this.apiLinterService.getLintingRules()

                    this.logger.info('Successfully fetched rules', {
                        requestId,
                        count: rules.length,
                    })

                    // Record metrics for successful tool invocation
                    const duration = Date.now() - startTime
                    Metrics.recordMcpTool('list_rules', 'success', duration)

                    // Transform the rules into the expected content format with explicit typing
                    const contentItems: Array<{ type: 'text'; text: string }> =
                        rules.map((rule) => ({
                            type: 'text' as const,
                            text: `Rule: ${rule.title} (ID: ${rule.wmRuleId}) - ${rule.url}`,
                        }))

                    // Return the response in the expected format
                    return {
                        content: contentItems,
                        rules: rules,
                        count: rules.length,
                        timestamp: new Date().toISOString(),
                    }
                } catch (error) {
                    // Record metrics for failed tool invocation
                    const duration = Date.now() - startTime
                    Metrics.recordMcpTool('list_rules', 'failure', duration)

                    this.logger.error('Error listing rules', {
                        requestId,
                        error,
                        stack: error instanceof Error ? error.stack : undefined,
                    })

                    // Return an error response in the expected format
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Failed to list rules: ${error instanceof Error ? error.message : String(error)}`,
                            },
                        ],
                        isError: true,
                    }
                }
            }
        )

        // Register API quality score tool
        this.logger.debug('Registering calculate_api_quality_score tool')
        this.server.tool(
            'calculate_api_quality_score',
            'Calculates a quality score for an API specification based on violation severity',
            {
                spec: z
                    .string()
                    .describe('API specification in JSON or YAML format'),
            },
            /**
             * Handler for API quality score calculation
             * @param param0 Object containing the API spec
             * @param param0.spec The API specification string (JSON/YAML)
             * @returns Quality score and breakdown based on violation severity
             */
            async ({ spec }) => {
                const requestId = `score-${Date.now()}`
                const startTime = Date.now() // Start time for metrics

                this.logger.info(
                    'Handling calculate_api_quality_score tool request',
                    {
                        requestId,
                        specLength: spec.length,
                    }
                )

                try {
                    // Validate the specification to get violations
                    this.logger.debug(
                        'Validating specification for quality scoring',
                        {
                            requestId,
                        }
                    )
                    const validationResults =
                        await this.apiLinterService.validateSpecification(spec)

                    // Count violations by severity level
                    const violationCounts = {
                        must: 0,
                        should: 0,
                        may: 0,
                        hint: 0,
                    }

                    // Process violations and count by severity
                    validationResults.violations.forEach((violation) => {
                        // Extract the severity level from the violation object
                        // Map to our simplified severity categories
                        const severityLevel =
                            violation.violation_type?.toLowerCase() || 'should'

                        if (
                            severityLevel.includes('must') ||
                            severityLevel === 'error'
                        ) {
                            violationCounts.must++
                        } else if (
                            severityLevel.includes('should') ||
                            severityLevel === 'warning'
                        ) {
                            violationCounts.should++
                        } else if (
                            severityLevel.includes('may') ||
                            severityLevel === 'info'
                        ) {
                            violationCounts.may++
                        } else {
                            violationCounts.hint++
                        }
                    })

                    // Calculate quality score based on specified criteria
                    let qualityScore = 10 // Start with perfect score
                    let qualityRating = 'Perfect'

                    // Apply scoring rules
                    if (violationCounts.must > 10) {
                        qualityScore = 2
                        qualityRating = 'Critical'
                    } else if (
                        violationCounts.must > 0 &&
                        violationCounts.must <= 10
                    ) {
                        qualityScore = 5
                        qualityRating = 'Poor'
                    } else if (
                        violationCounts.must === 0 &&
                        (violationCounts.should > 0 ||
                            violationCounts.may > 0 ||
                            violationCounts.hint > 0)
                    ) {
                        qualityScore = 7
                        qualityRating = 'Good'
                    } else {
                        // This means must = may = should = hint = 0
                        qualityScore = 10
                        qualityRating = 'Perfect'
                    }

                    this.logger.info('Quality score calculation completed', {
                        requestId,
                        qualityScore,
                        qualityRating,
                        violationCounts,
                    })

                    // Record metrics for successful tool invocation
                    const duration = Date.now() - startTime
                    Metrics.recordMcpTool(
                        'calculate_api_quality_score',
                        'success',
                        duration
                    )

                    // Determine if goal is achieved
                    const goalAchieved =
                        violationCounts.must === 0 &&
                        violationCounts.should === 0 &&
                        violationCounts.may === 0 &&
                        violationCounts.hint === 0

                    // Return the response with the quality score details
                    return {
                        content: [
                            {
                                type: 'text',
                                text:
                                    `# API Quality Score based on DevOps Maturity Score: ${qualityScore}/10 (${qualityRating})\n\n` +
                                    `## Violation Breakdown:\n` +
                                    `- MUST violations: ${violationCounts.must}\n` +
                                    `- SHOULD violations: ${violationCounts.should}\n` +
                                    `- MAY violations: ${violationCounts.may}\n` +
                                    `- HINT violations: ${violationCounts.hint}\n\n` +
                                    `Total violations: ${validationResults.violations.length}\n\n` +
                                    `## Scoring Rules:\n` +
                                    `• Score 2/10: More than 10 MUST violations\n` +
                                    `• Score 5/10: Between 1-10 MUST violations\n` +
                                    `• Score 7/10: No MUST violations but has other violations\n` +
                                    `• Score 10/10: No violations of any kind\n\n` +
                                    `${goalAchieved ? '🎉 GOAL ACHIEVED! Your API has no violations.' : '❌ GOAL NOT YET ACHIEVED'}` +
                                    `\n\n## How to achieve goal:\n` +
                                    `Fix all violations to reach a perfect 10/10 score. The goal is to have zero violations of all types:\n` +
                                    `- MUST = 0\n` +
                                    `- SHOULD = 0\n` +
                                    `- MAY = 0\n` +
                                    `- HINT = 0`,
                            },
                        ],
                        score: {
                            value: qualityScore,
                            rating: qualityRating,
                            breakdown: violationCounts,
                            totalViolations:
                                validationResults.violations.length,
                            goalAchieved: goalAchieved,
                            scoringRules: {
                                '2/10': 'More than 10 MUST violations',
                                '5/10': 'Between 1-10 MUST violations',
                                '7/10': 'No MUST violations but has other violations',
                                '10/10':
                                    'No violations of any kind (must = may = should = hint = 0)',
                            },
                        },
                        timestamp: new Date().toISOString(),
                    }
                } catch (error) {
                    // Record metrics for failed tool invocation
                    const duration = Date.now() - startTime
                    Metrics.recordMcpTool(
                        'calculate_api_quality_score',
                        'failure',
                        duration
                    )

                    this.logger.error('Error calculating API quality score', {
                        requestId,
                        error,
                        stack: error instanceof Error ? error.stack : undefined,
                    })

                    // Return an error response in the expected format
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Failed to calculate API quality score: ${error instanceof Error ? error.message : String(error)}`,
                            },
                        ],
                        isError: true,
                    }
                }
            }
        )

        // Register get rule categories tool
        this.logger.debug('Get get_rule_categories tool')
        this.server.tool(
            'get_rule_categories',
            'Get available rule categories and their descriptions',
            async () => {
                const requestId = `categories-${Date.now()}`
                const startTime = Date.now() // Start time for metrics

                this.logger.info('Handling get_rule_categories tool request', {
                    requestId,
                })

                try {
                    // Fetch the rules first - we'll extract categories from them
                    this.logger.debug('Fetching rules to extract categories', {
                        requestId,
                    })
                    const rules = await this.apiLinterService.getLintingRules()

                    // Extract unique categories and their descriptions
                    const categoriesMap = new Map<string, string>()

                    // Process rules to extract categories
                    rules.forEach((rule) => {
                        if (rule.type && !categoriesMap.has(rule.type)) {
                            // Store category with description (using default if not available)
                            categoriesMap.set(
                                rule.type,
                                rule.title || `Rules related to ${rule.type}`
                            )
                        }
                    })

                    // Convert to array of category objects
                    const categories = Array.from(categoriesMap.entries()).map(
                        ([name, description]) => ({
                            name,
                            description,
                            ruleCount: rules.filter(
                                (rule) => rule.type === name
                            ).length,
                        })
                    )

                    this.logger.info('Successfully extracted rule categories', {
                        requestId,
                        count: categories.length,
                    })

                    // Record metrics for successful tool invocation
                    const duration = Date.now() - startTime
                    Metrics.recordMcpTool(
                        'get_rule_categories',
                        'success',
                        duration
                    )

                    // Transform the categories into content items
                    const contentItems: Array<{ type: 'text'; text: string }> =
                        categories.map((category) => ({
                            type: 'text' as const,
                            text: `Category: ${category.name} (${category.ruleCount} rules)\nDescription: ${category.description}`,
                        }))

                    // Return the response in the expected format
                    return {
                        content: contentItems,
                        categories: categories,
                        count: categories.length,
                        timestamp: new Date().toISOString(),
                    }
                } catch (error) {
                    // Record metrics for failed tool invocation
                    const duration = Date.now() - startTime
                    Metrics.recordMcpTool(
                        'get_rule_categories',
                        'failure',
                        duration
                    )

                    this.logger.error('Error retrieving rule categories', {
                        requestId,
                        error,
                        stack: error instanceof Error ? error.stack : undefined,
                    })

                    // Return an error response in the expected format
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Failed to retrieve rule categories: ${error instanceof Error ? error.message : String(error)}`,
                            },
                        ],
                        isError: true,
                    }
                }
            }
        )

        this.logger.info('MCP tools registered successfully')
    }

    /**
     * Registers all MCP prompts for API Linter integration.
     * Sets up prompt definitions with parameters and handlers.
     * @private
     */
    private registerPrompts() {
        this.logger.info('Registering MCP prompts')

        // API Design Review prompt
        this.logger.debug('Registering api_design_review prompt')
        this.server.prompt(
            'api_design_review',
            'Analyze an API specification and provide design feedback based on best practices',
            {
                specification: z
                    .string()
                    .describe('API specification in JSON or YAML format'),
                focusAreas: z
                    .string()
                    .optional()
                    .describe(
                        'Comma-separated list of specific areas to focus on (e.g., "security,naming,consistency")'
                    ),
            },
            async ({ specification, focusAreas }) => {
                const requestId = `prompt-${Date.now()}`
                this.logger.info('Handling api_design_review prompt request', {
                    requestId,
                    specLength: specification.length,
                    focusAreas,
                })

                try {
                    this.logger.debug('Creating prompt template response', {
                        requestId,
                    })
                    return {
                        messages: [
                            {
                                role: 'user',
                                content: {
                                    type: 'text',
                                    text: `
You are an API design expert reviewing an OpenAPI/Swagger specification. Your task is to provide constructive feedback on the design to help improve it.

Specification:
{{specification}}

{{#if focusAreas}}
Focus specifically on these areas: {{focusAreas}}
{{/if}}

Provide your analysis in this structure:
1. Executive Summary - Brief overview of the API's purpose and design approach
2. Strengths - What aspects of the API design are well done
3. Areas for Improvement - Identify design issues categorized by:
   - Resource Naming & Hierarchy
   - Consistency & Patterns
   - Error Handling
   - Security Considerations
   - Performance Implications
   - Documentation Quality
4. Specific Recommendations - Concrete changes that would improve the API
`,
                                },
                            },
                        ],
                    }
                } catch (error) {
                    this.logger.error(
                        'Error processing api_design_review prompt',
                        {
                            requestId,
                            error,
                            stack:
                                error instanceof Error
                                    ? error.stack
                                    : undefined,
                        }
                    )

                    // Re-throw to be handled by MCP server
                    throw error
                }
            }
        )

        this.logger.info('MCP prompts registered successfully')
    }
}
