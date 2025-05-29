import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { ApiLinterMcpClient } from '.'

// Mock the MCP SDK
jest.mock('@modelcontextprotocol/sdk/client/index.js')
jest.mock('@modelcontextprotocol/sdk/client/streamableHttp.js')

describe('ApiLinterMcpClient', () => {
    let client: ApiLinterMcpClient
    let mockMcpClient: jest.Mocked<Client>
    let mockTransport: jest.Mocked<StreamableHTTPClientTransport>

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks()

        // Set up mock implementations
        mockMcpClient = {
            connect: jest.fn().mockResolvedValue(undefined),
            close: jest.fn().mockResolvedValue(undefined),
            callTool: jest.fn(),
            getPrompt: jest.fn(),
            setNotificationHandler: jest.fn(),
            onerror: jest.fn(),
            getServerCapabilities: jest.fn().mockReturnValue({}),
        } as unknown as jest.Mocked<Client>

        mockTransport = {
            close: jest.fn().mockResolvedValue(undefined),
            terminateSession: jest.fn().mockResolvedValue(undefined),
        } as unknown as jest.Mocked<StreamableHTTPClientTransport>

        // Mock constructor implementations
        ;(Client as jest.Mock).mockImplementation(() => mockMcpClient)
        ;(StreamableHTTPClientTransport as jest.Mock).mockImplementation(
            () => mockTransport
        )

        // Create the client instance
        client = new ApiLinterMcpClient('http://test-server/mcp', {
            debug: false,
        })
    })

    describe('constructor', () => {
        it('should create a new client with default options', () => {
            const defaultClient = new ApiLinterMcpClient()

            // Verify client initialization
            expect(Client).toHaveBeenCalledWith(
                {
                    name: 'api-linter-mcp-client',
                    version: '1.0.0',
                },
                expect.any(Object)
            )

            // Verify transport initialization with default URL
            expect(StreamableHTTPClientTransport).toHaveBeenCalledWith(
                expect.objectContaining({
                    href: expect.stringContaining('localhost:3000/mcp'),
                }),
                expect.any(Object)
            )
        })

        it('should create a new client with custom options', () => {
            const customClient = new ApiLinterMcpClient(
                'https://custom-server/mcp',
                {
                    clientName: 'custom-client',
                    clientVersion: '2.0.0',
                    timeout: 60000,
                    debug: true,
                }
            )

            // Verify client initialization with custom options
            expect(Client).toHaveBeenCalledWith(
                {
                    name: 'custom-client',
                    version: '2.0.0',
                },
                expect.any(Object)
            )

            // Verify transport initialization with custom URL
            expect(StreamableHTTPClientTransport).toHaveBeenCalledWith(
                expect.objectContaining({
                    href: expect.stringContaining('custom-server/mcp'),
                }),
                expect.any(Object)
            )
        })

        it('should set up notification handler on construction', () => {
            expect(mockMcpClient.setNotificationHandler).toHaveBeenCalled()
        })
    })

    describe('connect', () => {
        it('should connect to the server successfully', async () => {
            await client.connect()

            expect(mockMcpClient.connect).toHaveBeenCalledWith(mockTransport)
            expect(client.getConnectionStatus()).toBe(true)
        })

        it('should handle connection failures', async () => {
            const connectionError = new Error('Connection failed')
            mockMcpClient.connect.mockRejectedValueOnce(connectionError)

            await expect(client.connect()).rejects.toThrow(
                'Failed to connect to API Linter MCP server'
            )
            expect(client.getConnectionStatus()).toBe(false)
        })
    })

    describe('disconnect', () => {
        it('should disconnect from the server', async () => {
            // First connect
            await client.connect()

            // Then disconnect
            await client.disconnect()

            expect(mockTransport.close).toHaveBeenCalled()
            expect(client.getConnectionStatus()).toBe(false)
        })

        it('should not attempt to disconnect if not connected', async () => {
            // Don't connect first

            // Try to disconnect
            await client.disconnect()

            // Should not attempt to close transport
            expect(mockTransport.close).not.toHaveBeenCalled()
        })
    })

    describe('terminateSession', () => {
        it('should terminate the session when connected', async () => {
            // First connect
            await client.connect()

            // Then terminate session
            await client.terminateSession()

            expect(mockTransport.terminateSession).toHaveBeenCalled()
        })

        it('should not attempt to terminate session if not connected', async () => {
            // Don't connect first

            // Try to terminate session
            await client.terminateSession()

            // Should not attempt to terminate session
            expect(mockTransport.terminateSession).not.toHaveBeenCalled()
        })

        it('should handle session termination errors', async () => {
            // First connect
            await client.connect()

            // Mock termination error
            const terminationError = new Error('Termination not supported')
            mockTransport.terminateSession.mockRejectedValueOnce(
                terminationError
            )

            // Should not throw error even if termination fails
            await expect(client.terminateSession()).resolves.not.toThrow()
        })
    })

    describe('validateApiSpecification', () => {
        const mockSpecContent = 'openapi: 3.0.0'
        const mockValidationResult = {
            content: [
                {
                    type: 'text',
                    text: '❌ Found 2 issues in API specification:\n\n🔴 1 MUST violation\n  1. [Rule 1] First violation at /path1\n\n🟠 1 SHOULD violation\n  2. [Rule 2] Second violation at /path2\n\nValidation timestamp: 2025-04-29T10:00:00.000Z',
                },
            ],
        }

        beforeEach(() => {
            // Mock successful connection
            client.connect = jest.fn().mockResolvedValue(undefined)
            ;(client as any).isConnected = true

            // Mock successful validation
            mockMcpClient.callTool.mockResolvedValue(mockValidationResult)
        })

        it('should validate API specification successfully', async () => {
            const result =
                await client.validateApiSpecification(mockSpecContent)

            expect(mockMcpClient.callTool).toHaveBeenCalledWith(
                {
                    name: 'validate_api_specification',
                    arguments: {
                        spec: mockSpecContent,
                    },
                },
                expect.any(Object),
                expect.objectContaining({ timeout: expect.any(Number) })
            )

            // Verify result structure
            expect(result).toMatchObject({
                message: expect.any(String),
                violations: expect.any(Array),
                violationCount: 2,
                validationSuccess: false,
            })

            // Verify violations were parsed
            expect(result.violations).toHaveLength(2)
            expect(result.violations[0]).toMatchObject({
                index: 1,
                title: 'Rule 1',
                description: 'First violation',
                path: '/path1',
                type: 'MUST',
            })
        })

        it('should include rule IDs when specified', async () => {
            const ruleIds = ['rule1', 'rule2']
            await client.validateApiSpecification(mockSpecContent, ruleIds)

            expect(mockMcpClient.callTool).toHaveBeenCalledWith(
                {
                    name: 'validate_api_specification',
                    arguments: {
                        spec: mockSpecContent,
                        ruleIds,
                    },
                },
                expect.any(Object),
                expect.any(Object)
            )
        })

        it('should throw error if not connected', async () => {
            // Set client as disconnected
            ;(client as any).isConnected = false

            await expect(
                client.validateApiSpecification(mockSpecContent)
            ).rejects.toThrow('API Linter MCP Client is not connected')
        })

        it('should handle validation errors', async () => {
            const validationError = new Error('Validation failed')
            mockMcpClient.callTool.mockRejectedValueOnce(validationError)

            await expect(
                client.validateApiSpecification(mockSpecContent)
            ).rejects.toThrow('Error validating API specification')
        })

        it('should handle successful validation with no issues', async () => {
            const successResult = {
                content: [
                    {
                        type: 'text',
                        text: '✅ API Specification is valid! No issues found.',
                    },
                ],
            }

            mockMcpClient.callTool.mockResolvedValueOnce(successResult)

            const result =
                await client.validateApiSpecification(mockSpecContent)

            expect(result).toMatchObject({
                message: 'API Specification is valid!',
                violations: [],
                violationCount: 0,
                validationSuccess: true,
            })
        })

        it('should handle unparseable validation results', async () => {
            const strangeResult = {
                content: [
                    {
                        type: 'text',
                        text: 'Unexpected format that cannot be parsed',
                    },
                ],
            }

            mockMcpClient.callTool.mockResolvedValueOnce(strangeResult)

            const result =
                await client.validateApiSpecification(mockSpecContent)

            // Should return a basic result with raw content
            expect(result).toMatchObject({
                message: 'Unexpected format that cannot be parsed',
                violations: [],
                violationCount: 0,
                rawContent: expect.any(String),
            })
        })
    })

    describe('listRules', () => {
        const mockRulesResult = {
            content: [
                {
                    type: 'text',
                    text: 'Rule: Rule 1 (ID: rule1) - https://example.com/rule1\nRule: Rule 2 (ID: rule2) - https://example.com/rule2',
                },
            ],
            rules: [
                {
                    title: 'Rule 1',
                    wmRuleId: 'rule1',
                    url: 'https://example.com/rule1',
                },
                {
                    title: 'Rule 2',
                    wmRuleId: 'rule2',
                    url: 'https://example.com/rule2',
                },
            ],
        }

        beforeEach(() => {
            // Mock successful connection
            client.connect = jest.fn().mockResolvedValue(undefined)
            ;(client as any).isConnected = true

            // Mock successful rules list
            mockMcpClient.callTool.mockResolvedValue(mockRulesResult)
        })

        it('should list rules successfully', async () => {
            const rules = await client.listRules()

            expect(mockMcpClient.callTool).toHaveBeenCalledWith(
                {
                    name: 'list_rules',
                    arguments: {},
                },
                expect.any(Object)
            )

            // Should use rules array directly when available
            expect(rules).toHaveLength(2)
            expect(rules[0]).toMatchObject({
                title: 'Rule 1',
                wmRuleId: 'rule1',
                url: 'https://example.com/rule1',
            })
        })

        it('should parse rules from text content when rules array is not available', async () => {
            // Mock result without rules array
            const textOnlyResult = {
                content: [
                    {
                        type: 'text',
                        text: 'Rule: Rule 1 (ID: rule1) - https://example.com/rule1\nRule: Rule 2 (ID: rule2) - https://example.com/rule2',
                    },
                ],
            }

            mockMcpClient.callTool.mockResolvedValueOnce(textOnlyResult)

            const rules = await client.listRules()

            // Should extract rules from text content
            expect(rules).toHaveLength(2)
            expect(rules[0]).toMatchObject({
                title: 'Rule 1',
                wmRuleId: 'rule1',
                url: 'https://example.com/rule1',
            })
        })

        it('should throw error if not connected', async () => {
            // Set client as disconnected
            ;(client as any).isConnected = false

            await expect(client.listRules()).rejects.toThrow(
                'API Linter MCP Client is not connected'
            )
        })

        it('should handle listing errors', async () => {
            const listError = new Error('Listing failed')
            mockMcpClient.callTool.mockRejectedValueOnce(listError)

            await expect(client.listRules()).rejects.toThrow(
                'Error listing API linting rules'
            )
        })

        it('should handle empty rules list', async () => {
            const emptyResult = {
                content: [
                    {
                        type: 'text',
                        text: 'No rules found',
                    },
                ],
                rules: [],
            }

            mockMcpClient.callTool.mockResolvedValueOnce(emptyResult)

            const rules = await client.listRules()

            expect(rules).toHaveLength(0)
        })
    })
})
