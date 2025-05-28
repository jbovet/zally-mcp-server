import { McpService } from './mcpService'
import { ApiLinterService } from './apiLinterService'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { LinterResult, Rule } from '../models/apiLinter'
import { AppLogger } from '../utils/logger'

// Mock dependencies
jest.mock('@modelcontextprotocol/sdk/server/mcp.js')
jest.mock('./apiLinterService')
jest.mock('../utils/logger', () => {
    // Create a mock logger with all required methods
    const mockLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        http: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
    }

    return {
        getLogger: jest.fn().mockReturnValue(mockLogger),
        LoggerService: {
            getInstance: jest.fn().mockReturnValue(mockLogger),
        },
        AppLogger: jest.fn(),
    }
})

describe('McpService', () => {
    let mcpService: McpService
    let mockApiLinterService: jest.Mocked<ApiLinterService>
    let mockMcpServer: jest.Mocked<McpServer>
    let mockLogger: jest.Mocked<AppLogger>
    let mockTool: jest.Mock
    let mockPrompt: jest.Mock

    beforeEach(() => {
        jest.clearAllMocks()

        // Mock McpServer instance and its tool method
        mockTool = jest.fn().mockReturnValue({ enabled: true })
        mockPrompt = jest.fn().mockReturnValue({ enabled: true })
        mockMcpServer = {
            tool: mockTool,
            prompt: mockPrompt,
        } as unknown as jest.Mocked<McpServer>

        // Mock McpServer constructor to return our mock instance
        ;(McpServer as jest.Mock).mockImplementation(() => mockMcpServer)

        // Mock ApiLinterService
        mockApiLinterService = {
            validateSpecification: jest.fn(),
            validateSpecificationWithRules: jest.fn(),
            getLintingRules: jest.fn(),
            formatLinterResults: jest.fn(),
        } as unknown as jest.Mocked<ApiLinterService>

        // Mock logger
        mockLogger = {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            http: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
        } as unknown as jest.Mocked<AppLogger>

        // Create service instance with logger
        mcpService = new McpService(mockApiLinterService, mockLogger)
    })

    describe('initialization', () => {
        it('should create McpServer with correct settings', () => {
            expect(McpServer).toHaveBeenCalledWith({
                name: 'ApiLinterServer-Integration',
                version: '1.0.0',
            })

            // Verify initialization is logged
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Initializing MCP server'
            )
            expect(mockLogger.info).toHaveBeenCalledWith(
                'MCP server initialized successfully'
            )
        })

        it('should register tools during initialization', () => {
            expect(mockMcpServer.tool).toHaveBeenCalledTimes(4)

            // Verify tool registration is logged
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Registering MCP tools'
            )
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Registering validate_api_specification tool'
            )
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Registering list_rules tool'
            )
            expect(mockLogger.info).toHaveBeenCalledWith(
                'MCP tools registered successfully'
            )

            // Verify the validate_api_specification tool registration
            expect(mockMcpServer.tool).toHaveBeenCalledWith(
                'validate_api_specification',
                'Validates an API specification (OpenAPI/Swagger) against API Linter rules',
                expect.any(Object), // Schema object
                expect.any(Function) // Callback function
            )

            // Verify the list_rules tool registration
            expect(mockMcpServer.tool).toHaveBeenCalledWith(
                'list_rules',
                'Lists all available API Linter rules',
                expect.any(Function) // Callback function
            )
        })
    })

    it('should register prompts during initialization', () => {
        expect(mockMcpServer.prompt).toHaveBeenCalledTimes(1)

        // Verify prompt registration is logged
        expect(mockLogger.info).toHaveBeenCalledWith('Registering MCP prompts')
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'Registering api_design_review prompt'
        )
        expect(mockLogger.info).toHaveBeenCalledWith(
            'MCP prompts registered successfully'
        )

        // Verify the api_design_review prompt registration
        expect(mockMcpServer.prompt).toHaveBeenCalledWith(
            'api_design_review',
            'Analyze an API specification and provide design feedback based on best practices',
            expect.any(Object),
            expect.any(Function)
        )
    })

    describe('getServer', () => {
        it('should return the McpServer instance', () => {
            const server = mcpService.getServer()
            expect(server).toBe(mockMcpServer)
        })
    })

    describe('validate_api_specification tool', () => {
        it('should call apiLinterService.validateSpecification when no ruleIds provided', async () => {
            // Get the tool registration call args
            const validateToolArgs = mockTool.mock.calls.find(
                (call) => call[0] === 'validate_api_specification'
            )

            // Extract callback function from registration
            const callback = validateToolArgs[3]

            // Mock data
            const specContent = 'openapi: 3.0.0'
            const linterResult: LinterResult = {
                external_id: 'test',
                message: 'Test validation',
                violations: [],
                violations_count: new Map(),
            }

            // Mock service responses
            mockApiLinterService.validateSpecification.mockResolvedValue(
                linterResult
            )
            mockApiLinterService.formatLinterResults.mockReturnValue(
                'Formatted results'
            )

            // Call the tool callback
            const result = await callback({ spec: specContent })

            // Verify logging occurred
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Handling validate_api_specification tool request',
                expect.objectContaining({
                    specLength: specContent.length,
                })
            )

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Validating with all active rules',
                expect.any(Object)
            )

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Formatting validation results',
                expect.objectContaining({
                    violationsCount: 0,
                })
            )

            expect(mockLogger.info).toHaveBeenCalledWith(
                'Validation completed successfully',
                expect.objectContaining({
                    violationsCount: 0,
                })
            )

            // Verify service was called correctly
            expect(
                mockApiLinterService.validateSpecification
            ).toHaveBeenCalledWith(specContent)
            expect(
                mockApiLinterService.formatLinterResults
            ).toHaveBeenCalledWith(linterResult)

            // Verify expected response format
            expect(result).toEqual({
                content: [
                    {
                        type: 'text',
                        text: 'Validation completed. Found 0 issues.',
                    },
                    {
                        type: 'text',
                        text: 'Formatted results',
                    },
                ],
            })
        })

        it('should call apiLinterService.validateSpecificationWithRules when ruleIds provided', async () => {
            // Get the tool registration call args
            const validateToolArgs = mockTool.mock.calls.find(
                (call) => call[0] === 'validate_api_specification'
            )

            // Extract callback function from registration
            const callback = validateToolArgs[3]

            // Mock data
            const specContent = 'openapi: 3.0.0'
            const ruleIds = ['rule1', 'rule2']
            const linterResult: LinterResult = {
                external_id: 'test',
                message: 'Test validation',
                violations: [
                    {
                        title: 'Test Violation',
                        description: 'This is a test violation',
                        violation_type: 'MUST',
                        rule_link: 'https://example.com/rules/1',
                        paths: ['/test/path'],
                    },
                ],
                violations_count: new Map([['MUST', 1]]),
            }

            // Mock service responses
            mockApiLinterService.validateSpecificationWithRules.mockResolvedValue(
                linterResult
            )
            mockApiLinterService.formatLinterResults.mockReturnValue(
                'Formatted results'
            )

            // Call the tool callback
            const result = await callback({ spec: specContent, ruleIds })

            // Verify logging with ruleIds
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Handling validate_api_specification tool request',
                expect.objectContaining({
                    specLength: specContent.length,
                    ruleIdsCount: ruleIds.length,
                })
            )

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Validating with specific rule IDs',
                expect.objectContaining({
                    ruleIds,
                })
            )

            // Verify service was called correctly
            expect(
                mockApiLinterService.validateSpecificationWithRules
            ).toHaveBeenCalledWith(specContent, ruleIds)
            expect(
                mockApiLinterService.formatLinterResults
            ).toHaveBeenCalledWith(linterResult)

            // Verify expected response format
            expect(result).toEqual({
                content: [
                    {
                        type: 'text',
                        text: 'Validation completed. Found 1 issues.',
                    },
                    {
                        type: 'text',
                        text: 'Formatted results',
                    },
                ],
            })
        })

        it('should handle errors during validation', async () => {
            // Get the tool registration call args
            const validateToolArgs = mockTool.mock.calls.find(
                (call) => call[0] === 'validate_api_specification'
            )

            // Extract callback function from registration
            const callback = validateToolArgs[3]

            // Mock error scenario
            const testError = new Error('Test validation error')
            mockApiLinterService.validateSpecification.mockRejectedValue(
                testError
            )

            // Call the tool callback
            const result = await callback({ spec: 'invalid spec' })

            // Verify error logging
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error validating API specification',
                expect.objectContaining({
                    error: testError,
                    stack: expect.any(String),
                })
            )

            // Verify error response format
            expect(result).toEqual({
                content: [
                    {
                        type: 'text',
                        text: 'Error validating specification: Test validation error',
                    },
                ],
                isError: true,
            })
        })
    })

    describe('list_rules tool', () => {
        it('should call apiLinterService.getLintingRules and format the response', async () => {
            // Get the tool registration call args directly from mockTool.mock.calls
            // Looking for the call that was used to register 'list_rules'
            const listRulesCalls = mockTool.mock.calls.filter(
                (call) => call[0] === 'list_rules'
            )

            // Since the implementation uses:
            // this.server.tool('list_rules', 'Lists all available API Linter rules', async () => {...})
            // The callback is at index 2 (third argument)
            const callback = listRulesCalls[0][2]

            // Mock data
            const mockRules: Rule[] = [
                {
                    title: 'Rule 1',
                    type: 'MUST',
                    url: 'https://example.com/rules/1',
                    code: 'RULE_1',
                    isActive: true,
                    wmRuleId: 'WM001',
                },
                {
                    title: 'Rule 2',
                    type: 'SHOULD',
                    url: 'https://example.com/rules/2',
                    code: 'RULE_2',
                    isActive: false,
                    wmRuleId: 'WM002',
                },
            ]

            // Mock service response
            mockApiLinterService.getLintingRules.mockResolvedValue(mockRules)

            // Call the tool callback
            const result = await callback()

            // Verify logging
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Handling list_rules tool request',
                expect.any(Object)
            )

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Fetching rules from API linter service',
                expect.any(Object)
            )

            expect(mockLogger.info).toHaveBeenCalledWith(
                'Successfully fetched rules',
                expect.objectContaining({
                    count: 2,
                })
            )

            // Verify service was called correctly
            expect(mockApiLinterService.getLintingRules).toHaveBeenCalled()

            // Verify expected response format
            expect(result).toEqual({
                content: expect.arrayContaining([
                    expect.objectContaining({
                        type: 'text',
                        text: expect.stringContaining(
                            'Rule: Rule 1 (ID: WM001)'
                        ),
                    }),
                    expect.objectContaining({
                        type: 'text',
                        text: expect.stringContaining(
                            'Rule: Rule 2 (ID: WM002)'
                        ),
                    }),
                ]),
                rules: mockRules,
                count: 2,
                timestamp: expect.any(String),
            })
        })
    })

    describe('api_design_review prompt', () => {
        it('should handle the api_design_review prompt callback correctly', async () => {
            // Get the prompt registration call args
            const promptArgs = mockPrompt.mock.calls.find(
                (call) => call[0] === 'api_design_review'
            )

            // Extract callback function from registration
            const callback = promptArgs[3]

            // Mock input data
            const specification = 'openapi: 3.0.0'
            const focusAreas = 'security,naming'

            // Call the prompt callback
            const result = await callback({ specification, focusAreas })

            // Verify logging
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Handling api_design_review prompt request',
                expect.objectContaining({
                    specLength: specification.length,
                    focusAreas,
                })
            )

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Creating prompt template response',
                expect.any(Object)
            )

            // Verify expected response format
            expect(result).toEqual({
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: expect.stringContaining(
                                'You are an API design expert reviewing an OpenAPI/Swagger specification'
                            ),
                        },
                    },
                ],
            })

            // Verify that the template contains the input data
            const textContent = result.messages[0].content.text
            expect(textContent).toContain('{{specification}}')
            expect(textContent).toContain('{{#if focusAreas}}')
            expect(textContent).toContain(
                'Focus specifically on these areas: {{focusAreas}}'
            )
        })

        it('should handle errors in api_design_review prompt handler', async () => {
            // Get the prompt registration call args
            const promptArgs = mockPrompt.mock.calls.find(
                (call) => call[0] === 'api_design_review'
            )

            // Extract callback function from registration
            const callback = promptArgs[3]

            // Set up a scenario where debug throws an error
            mockLogger.debug.mockImplementationOnce(() => {
                throw new Error('Debug logging error')
            })

            // Mock input data
            const specification = 'openapi: 3.0.0'

            // Call the prompt callback and expect it to throw
            await expect(callback({ specification })).rejects.toThrow(
                'Debug logging error'
            )

            // Verify error logging
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error processing api_design_review prompt',
                expect.objectContaining({
                    error: expect.any(Error),
                    stack: expect.any(String),
                })
            )
        })
    })
})
