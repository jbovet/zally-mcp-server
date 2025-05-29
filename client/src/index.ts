import {
    Client,
    ClientOptions,
} from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import {
    LoggingMessageNotificationSchema,
    CallToolResultSchema,
} from '@modelcontextprotocol/sdk/types.js'

/**
 * Client class for interacting with the API Linter service via MCP
 *
 * This client provides methods for:
 * - Validating API specifications against linting rules
 * - Listing available linting rules
 * - Getting API design reviews using LLM-powered prompts
 *
 * @example
 * ```typescript
 * const client = new ApiLinterMcpClient('http://localhost:3000/mcp');
 * await client.connect();
 *
 * // Validate an API specification
 * const result = await client.validateApiSpecification(apiSpecContent);
 * console.log(result.violations.length, 'violations found');
 *
 * // Get API design review
 * const review = await client.getApiDesignReview(apiSpecContent, 'security,naming');
 * console.log(review);
 * ```
 */
export class ApiLinterMcpClient {
    private client: Client
    private transport: StreamableHTTPClientTransport
    private isConnected = false
    private notificationListeners: ((
        level: string,
        message: string
    ) => void)[] = []

    /**
     * Creates a new API Linter MCP client
     * @param serverUrl URL to the API Linter MCP endpoint - defaults to http://localhost:3000/mcp
     * @param options Additional client options
     */
    constructor(
        private serverUrl: string = 'http://localhost:3000/mcp',
        private options: {
            clientName?: string
            clientVersion?: string
            timeout?: number
            debug?: boolean
        } = {}
    ) {
        const clientOptions: ClientOptions = {
            capabilities: {
                logging: {},
            },
        }

        this.client = new Client(
            {
                name: options.clientName || 'api-linter-mcp-client',
                version: options.clientVersion || '1.0.0',
            },
            clientOptions
        )

        // Create transport
        this.transport = new StreamableHTTPClientTransport(
            new URL(this.serverUrl),
            {
                requestInit: {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
            }
        )

        // Set up error handler
        this.client.onerror = (error) => {
            if (this.options.debug) {
                console.error('[API Linter MCP Client Error]:', error)
            }
        }

        // Set up logging notification handler
        this.client.setNotificationHandler(
            LoggingMessageNotificationSchema,
            (notification) => {
                const { level, data } = notification.params

                // Notify all listeners
                for (const listener of this.notificationListeners) {
                    listener(
                        level,
                        typeof data === 'string' ? data : JSON.stringify(data)
                    )
                }

                // Log if debug is enabled
                if (this.options.debug) {
                    console.log(`[API Linter MCP ${level}]:`, data)
                }
            }
        )
    }

    /**
     * Connects to the API Linter MCP server
     * @returns Promise that resolves when connection is established
     * @throws Error if connection fails
     */
    async connect(): Promise<void> {
        try {
            await this.client.connect(this.transport)
            this.isConnected = true

            if (this.options.debug) {
                console.log(
                    '[API Linter MCP Client]: Connected to server at',
                    this.serverUrl
                )

                // Log server capabilities if in debug mode
                const capabilities = this.client.getServerCapabilities()
                console.log(
                    '[API Linter MCP Client]: Server capabilities:',
                    capabilities
                )
            }
        } catch (error) {
            this.isConnected = false
            throw new Error(
                `Failed to connect to API Linter MCP server: ${error}`
            )
        }
    }

    /**
     * Disconnects from the API Linter MCP server
     */
    async disconnect(): Promise<void> {
        if (this.isConnected) {
            await this.transport.close()
            this.isConnected = false

            if (this.options.debug) {
                console.log('[API Linter MCP Client]: Disconnected from server')
            }
        }
    }

    /**
     * Registers a listener for notifications from the server
     * @param listener Function to call when a notification is received
     * @returns Function to remove the listener
     */
    onNotification(
        listener: (level: string, message: string) => void
    ): () => void {
        this.notificationListeners.push(listener)

        // Return a function to remove this listener
        return () => {
            const index = this.notificationListeners.indexOf(listener)
            if (index !== -1) {
                this.notificationListeners.splice(index, 1)
            }
        }
    }

    /**
     * Checks if the client is connected to the server
     * @returns True if connected, false otherwise
     */
    getConnectionStatus(): boolean {
        return this.isConnected
    }

    /**
     * Validates an API specification against linting rules
     * @param specContent API specification content (OpenAPI/Swagger) in JSON or YAML format
     * @param ruleIds Optional array of specific rule IDs to validate against
     * @returns Validation results with any violations found
     * @throws Error if validation fails
     */
    async validateApiSpecification(
        specContent: string,
        ruleIds?: string[]
    ): Promise<ApiLinterValidationResult> {
        this.ensureConnected()

        try {
            const params = {
                name: 'validate_api_specification',
                arguments: {
                    spec: specContent,
                    ...(ruleIds && ruleIds.length > 0 ? { ruleIds } : {}),
                },
            }

            const result = await this.client.callTool(
                params,
                CallToolResultSchema,
                { timeout: this.options.timeout || 60000 }
            )

            // Parse the result text to extract validation data
            // The validation result is in the content array as text
            return this.parseValidationResult(result)
        } catch (error) {
            throw new Error(`Error validating API specification: ${error}`)
        }
    }

    /**
     * Lists all available API linting rules
     * @returns Array of rule information
     * @throws Error if request fails
     */
    async listRules(): Promise<ApiLinterRule[]> {
        this.ensureConnected()

        try {
            const params = {
                name: 'list_rules',
                arguments: {},
            }

            const result = await this.client.callTool(
                params,
                CallToolResultSchema
            )

            // Rules are returned in the result
            // The data object might include the rules directly
            return this.parseRulesList(result)
        } catch (error) {
            throw new Error(`Error listing API linting rules: ${error}`)
        }
    }

    /**
     * Gets an AI-powered design review for an API specification
     * @param specContent API specification content (OpenAPI/Swagger) in JSON or YAML format
     * @param focusAreas Optional comma-separated list of areas to focus on (e.g., "security,naming,consistency")
     * @returns The design review prompt response that can be used with an LLM
     * @throws Error if request fails
     */
    async getApiDesignReview(
        specContent: string,
        focusAreas?: string
    ): Promise<ApiDesignReviewResult> {
        this.ensureConnected()

        try {
            const params = {
                name: 'api_design_review',
                arguments: {
                    specification: specContent,
                    ...(focusAreas ? { focusAreas } : {}),
                },
            }

            const result = await this.client.getPrompt(params)

            return {
                messages: result.messages.map((msg) => ({
                    role: msg.role,
                    content:
                        msg.content.type === 'text'
                            ? msg.content.text
                            : JSON.stringify(msg.content),
                })),
            }
        } catch (error) {
            throw new Error(`Error getting API design review: ${error}`)
        }
    }

    /**
     * Terminates the current session with the server
     * This is useful for explicitly cleaning up resources on the server
     */
    async terminateSession(): Promise<void> {
        if (this.isConnected) {
            try {
                await this.transport.terminateSession()

                if (this.options.debug) {
                    console.log('[API Linter MCP Client]: Session terminated')
                }
            } catch (error) {
                // Some servers don't support session termination, which is fine
                if (this.options.debug) {
                    console.log(
                        '[API Linter MCP Client]: Session termination not supported or failed:',
                        error
                    )
                }
            }
        }
    }

    /**
     * Checks if the client is connected and throws an error if not
     * @private
     * @throws Error if client is not connected
     */
    private ensureConnected(): void {
        if (!this.isConnected) {
            throw new Error(
                'API Linter MCP Client is not connected. Call connect() first.'
            )
        }
    }

    /**
     * Parses the validation result from the tool response
     * @private
     * @param result The raw tool result from the MCP server
     * @returns Structured validation result
     */
    private parseValidationResult(result: any): ApiLinterValidationResult {
        // Example of parsing the text content into a structured format
        // The format depends on how the server formats its response

        try {
            // First, we find the text content from the result
            const textContent = result.content
                .filter((item: any) => item.type === 'text')
                .map((item: any) => item.text)
                .join('\n')

            // Parse violations from the text
            const validationResult: ApiLinterValidationResult = {
                message: '',
                violations: [],
                violationCount: 0,
                rawContent: textContent,
            }

            // Check if no violations were found (success case)
            if (
                textContent.includes('✅') ||
                textContent.includes('No issues found')
            ) {
                validationResult.message = 'API Specification is valid!'
                validationResult.validationSuccess = true
                return validationResult
            }

            // Parse violation count
            const countMatch = textContent.match(/Found (\d+) issues?/)
            if (countMatch) {
                validationResult.violationCount = parseInt(countMatch[1], 10)
            }

            // Parse message
            const firstLine = textContent.split('\n')[0]
            validationResult.message =
                firstLine || 'API Specification validation completed'

            // Extract violations from the text
            const violations: ApiLinterViolation[] = []

            // Match patterns like "1. [Rule Title] Description at path"
            const violationRegex =
                /\s+(\d+)\.\s+\[([^\]]+)\]\s+(.+?)(?:\s+at\s+(.+))?$/gm
            let match

            while ((match = violationRegex.exec(textContent)) !== null) {
                violations.push({
                    index: parseInt(match[1], 10),
                    title: match[2],
                    description: match[3],
                    path: match[4] || '',
                    type: this.determineViolationType(textContent, match[1]),
                })
            }

            validationResult.violations = violations
            validationResult.validationSuccess = violations.length === 0

            return validationResult
        } catch (error) {
            // If parsing fails, return a basic result with the raw content
            return {
                message: 'Failed to parse validation result',
                violations: [],
                violationCount: 0,
                rawContent: JSON.stringify(result.content),
            }
        }
    }

    /**
     * Determines the violation type from the validation text
     * @private
     * @param text The full validation text
     * @param index The violation index to look for
     * @returns The violation type (MUST, SHOULD, MAY, HINT)
     */
    private determineViolationType(text: string, index: string): string {
        // Look for sections like "🔴 5 MUST violations" and check if our index is in that range
        if (text.includes(`🔴`) && text.includes('MUST violation')) {
            return 'MUST'
        } else if (text.includes(`🟠`) && text.includes('SHOULD violation')) {
            return 'SHOULD'
        } else if (text.includes(`🟡`) && text.includes('MAY violation')) {
            return 'MAY'
        } else if (text.includes(`🔵`) && text.includes('HINT')) {
            return 'HINT'
        }
        return 'UNKNOWN'
    }

    /**
     * Parses the rules list from the tool response
     * @private
     * @param result The raw tool result from the MCP server
     * @returns Array of rule information
     */
    private parseRulesList(result: any): ApiLinterRule[] {
        try {
            // If the result has a rules property, use it directly
            if (result.rules && Array.isArray(result.rules)) {
                return result.rules
            }

            // Otherwise, parse from the text content
            const textContent = result.content
                .filter((item: any) => item.type === 'text')
                .map((item: any) => item.text)
                .join('\n')

            const rules: ApiLinterRule[] = []

            // Parse each rule from lines like "Rule: Title (ID: wmRuleId) - url"
            const ruleRegex = /Rule: ([^(]+) \(ID: ([^)]+)\) - (.+)$/gm
            let match

            while ((match = ruleRegex.exec(textContent)) !== null) {
                rules.push({
                    title: match[1].trim(),
                    wmRuleId: match[2].trim(),
                    url: match[3].trim(),
                })
            }

            return rules
        } catch (error) {
            return []
        }
    }
}

/**
 * Represents an API linting rule
 */
export interface ApiLinterRule {
    /**
     * Human-readable title of the rule
     */
    title: string

    /**
     * Unique identifier for the rule
     */
    wmRuleId: string

    /**
     * Type of the rule (MUST, SHOULD, MAY, HINT)
     */
    type?: string

    /**
     * URL to documentation for the rule
     */
    url?: string

    /**
     * Whether the rule is currently active
     */
    isActive?: boolean
}

/**
 * Represents a validation result from the API Linter
 */
export interface ApiLinterValidationResult {
    /**
     * Summary message about the validation result
     */
    message: string

    /**
     * List of violations found in the specification
     */
    violations: ApiLinterViolation[]

    /**
     * Total number of violations found
     */
    violationCount: number

    /**
     * Whether validation was successful (no violations)
     */
    validationSuccess?: boolean

    /**
     * Raw content from the validation response
     */
    rawContent?: string
}

/**
 * Represents a specific rule violation in an API specification
 */
export interface ApiLinterViolation {
    /**
     * Index of the violation in the list
     */
    index: number

    /**
     * Title of the violated rule
     */
    title: string

    /**
     * Description of the violation
     */
    description: string

    /**
     * JSON path or location where the violation occurred
     */
    path: string

    /**
     * Type of violation (MUST, SHOULD, MAY, HINT)
     */
    type: string

    /**
     * Line numbers in the source file (if available)
     */
    startLine?: number

    /**
     * Line numbers in the source file (if available)
     */
    endLine?: number
}

/**
 * Represents the result of an API design review
 */
export interface ApiDesignReviewResult {
    /**
     * Messages to be used with an LLM to get the design review
     */
    messages: Array<{
        /**
         * Role of the message (user, assistant)
         */
        role: string

        /**
         * Content of the message
         */
        content: string
    }>
}
