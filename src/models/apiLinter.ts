/**
 * API Linter model objects
 */

/**
 * Represents a rule in the ApiLinterServer.
 * @interface Rule
 * @property {string} title - The human-readable name of the rule
 * @property {string} type - The category or type classification of the rule
 * @property {string} url - Documentation link for the rule
 * @property {string} code - The implementation code identifier for the rule
 * @property {boolean} isActive - Whether the rule is currently enabled
 * @property {string} wmRuleId - Unique identifier for the rule
 */
interface Rule {
    title: string
    type: string
    url: string
    code: string
    isActive: boolean
    wmRuleId: string
}

/**
 * Represents the result of a linting operation on an API specification.
 * @interface LinterResult
 * @property {string} external_id - Unique identifier for the linting session
 * @property {string} message - Summary message about the linting result
 * @property {Violation[]} violations - List of detected violations in the specification
 * @property {Map<string, number>} violations_count - Count of violations grouped by type
 */
interface LinterResult {
    external_id: string
    message: string
    violations: Violation[]
    violations_count: Map<string, number>
}

/**
 * Represents a specific rule violation found in an API specification.
 * @interface Violation
 * @property {string} title - Short description of the violation
 * @property {string} description - Detailed explanation of the issue
 * @property {string} violation_type - Category of the violation
 * @property {string} rule_link - URL to documentation about the violated rule
 * @property {string[]} paths - JSON paths to the locations in the API spec where the violation occurred
 * @property {number} [startLine] - Optional starting line number in the source file
 * @property {number} [endLine] - Optional ending line number in the source file
 */
interface Violation {
    title: string
    description: string
    violation_type: string
    rule_link: string
    paths: string[]
    startLine?: number
    endLine?: number
}

export { Rule, LinterResult, Violation }
