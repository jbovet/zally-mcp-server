import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import {
    LoggingMessageNotificationSchema,
    ResourceListChangedNotificationSchema,
    ListResourcesResultSchema,
    ListToolsRequest,
    ListToolsResultSchema,
    CallToolRequest,
    CallToolResultSchema,
    ListPromptsRequest,
    ListPromptsResultSchema,
    GetPromptRequest,
    GetPromptResultSchema,
    ListResourcesRequest,
} from '@modelcontextprotocol/sdk/types.js'
import { createInterface } from 'node:readline'
import fs from 'fs/promises'
import path from 'path'

// Create readline interface for user input
const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
})

// Track received notifications for debugging resumability
let notificationCount = 0

// Global client and transport for interactive commands
let client: Client | null = null
let transport: StreamableHTTPClientTransport | null = null
let serverUrl = 'http://localhost:8080/mcp'
let notificationsToolLastEventId: string | undefined = undefined
let sessionId: string | undefined = undefined

async function main(): Promise<void> {
    console.log('API Linter MCP Interactive Client')
    console.log('=================================')

    // Connect to server immediately with default settings
    await connect()

    // Print help and start the command loop
    printHelp()
    commandLoop()
}

function printHelp(): void {
    console.log('\nAvailable commands:')
    console.log(
        '  connect [url]              - Connect to MCP server (default: http://localhost:8080/mcp)'
    )
    console.log('  disconnect                 - Disconnect from server')
    console.log('  terminate-session          - Terminate the current session')
    console.log('  reconnect                  - Reconnect to the server')
    console.log('  list-tools                 - List available tools')
    console.log(
        '  list-rules [isActive]      - List API linter rules (true/false for active status)'
    )
    console.log(
        '  validate-api <filename>    - Validate API specification from file'
    )
    console.log(
        '  validate-api-rules <filename> <ruleId1,ruleId2,...> - Validate with specific rules'
    )
    console.log('  list-prompts               - List available prompts')
    console.log(
        '  get-prompt [name] [args]   - Get a prompt with optional JSON arguments'
    )
    console.log('  list-resources             - List available resources')
    console.log('  help                       - Show this help')
    console.log('  quit                       - Exit the program')
}

function commandLoop(): void {
    readline.question('\n> ', async (input) => {
        const args = input.trim().split(/\s+/)
        const command = args[0]?.toLowerCase()

        try {
            switch (command) {
                case 'connect':
                    await connect(args[1])
                    break

                case 'disconnect':
                    await disconnect()
                    break

                case 'terminate-session':
                    await terminateSession()
                    break

                case 'reconnect':
                    await reconnect()
                    break

                case 'list-tools':
                    await listTools()
                    break

                case 'call-tool':
                    if (args.length < 2) {
                        console.log('Usage: call-tool <name> [args]')
                    } else {
                        const toolName = args[1]
                        let toolArgs = {}
                        if (args.length > 2) {
                            try {
                                toolArgs = JSON.parse(args.slice(2).join(' '))
                            } catch {
                                console.log(
                                    'Invalid JSON arguments. Using empty args.'
                                )
                            }
                        }
                        await callTool(toolName, toolArgs)
                    }
                    break

                case 'list-rules':
                    // Parse isActive parameter if provided
                    let isActive: boolean | undefined = undefined
                    if (args.length > 1) {
                        isActive = args[1].toLowerCase() === 'true'
                    }
                    await listRules(isActive)
                    break

                case 'validate-api':
                    if (args.length < 2) {
                        console.log('Usage: validate-api <filename>')
                    } else {
                        await validateApi(args[1])
                    }
                    break

                case 'validate-api-rules':
                    if (args.length < 3) {
                        console.log(
                            'Usage: validate-api-rules <filename> <ruleId1,ruleId2,...>'
                        )
                    } else {
                        const filename = args[1]
                        const ruleIds = args[2].split(',')
                        await validateApiWithRules(filename, ruleIds)
                    }
                    break

                case 'list-prompts':
                    await listPrompts()
                    break

                case 'get-prompt':
                    if (args.length < 2) {
                        console.log('Usage: get-prompt <name> [args]')
                    } else {
                        const promptName = args[1]
                        let promptArgs = {}
                        if (args.length > 2) {
                            try {
                                promptArgs = JSON.parse(args.slice(2).join(' '))
                            } catch {
                                console.log(
                                    'Invalid JSON arguments. Using empty args.'
                                )
                            }
                        }
                        await getPrompt(promptName, promptArgs)
                    }
                    break

                case 'list-resources':
                    await listResources()
                    break

                case 'help':
                    printHelp()
                    break

                case 'quit':
                case 'exit':
                    await cleanup()
                    return

                default:
                    if (command) {
                        console.log(`Unknown command: ${command}`)
                    }
                    break
            }
        } catch (error) {
            console.error(`Error executing command: ${error}`)
        }

        // Continue the command loop
        commandLoop()
    })
}

async function connect(url?: string): Promise<void> {
    if (client) {
        console.log('Already connected. Disconnect first.')
        return
    }

    if (url) {
        serverUrl = url
    }

    console.log(`Connecting to ${serverUrl}...`)

    try {
        // Create a new client
        client = new Client({
            name: 'api-linter-client',
            version: '1.0.0',
        })
        client.onerror = (error) => {
            console.error('\x1b[31mClient error:', error, '\x1b[0m')
        }

        transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
            sessionId: sessionId,
        })

        // Set up notification handlers
        client.setNotificationHandler(
            LoggingMessageNotificationSchema,
            (notification) => {
                notificationCount++
                console.log(
                    `\nNotification #${notificationCount}: ${notification.params.level} - ${notification.params.data}`
                )
                // Re-display the prompt
                process.stdout.write('> ')
            }
        )

        client.setNotificationHandler(
            ResourceListChangedNotificationSchema,
            async (_) => {
                console.log(`\nResource list changed notification received!`)
                try {
                    if (!client) {
                        console.log(
                            'Client disconnected, cannot fetch resources'
                        )
                        return
                    }
                    const resourcesResult = await client.request(
                        {
                            method: 'resources/list',
                            params: {},
                        },
                        ListResourcesResultSchema
                    )
                    console.log(
                        'Available resources count:',
                        resourcesResult.resources.length
                    )
                } catch {
                    console.log(
                        'Failed to list resources after change notification'
                    )
                }
                // Re-display the prompt
                process.stdout.write('> ')
            }
        )

        // Connect the client
        await client.connect(transport)
        sessionId = transport.sessionId
        console.log('Transport created with session ID:', sessionId)
        console.log('Connected to MCP server')
    } catch (error) {
        console.error('Failed to connect:', error)
        client = null
        transport = null
    }
}

async function disconnect(): Promise<void> {
    if (!client || !transport) {
        console.log('Not connected.')
        return
    }

    try {
        await transport.close()
        console.log('Disconnected from MCP server')
        client = null
        transport = null
    } catch (error) {
        console.error('Error disconnecting:', error)
    }
}

async function terminateSession(): Promise<void> {
    if (!client || !transport) {
        console.log('Not connected.')
        return
    }

    try {
        console.log('Terminating session with ID:', transport.sessionId)
        await transport.terminateSession()
        console.log('Session terminated successfully')

        // Check if sessionId was cleared after termination
        if (!transport.sessionId) {
            console.log('Session ID has been cleared')
            sessionId = undefined

            // Also close the transport and clear client objects
            await transport.close()
            console.log('Transport closed after session termination')
            client = null
            transport = null
        } else {
            console.log(
                'Server responded with 405 Method Not Allowed (session termination not supported)'
            )
            console.log('Session ID is still active:', transport.sessionId)
        }
    } catch (error) {
        console.error('Error terminating session:', error)
    }
}

async function reconnect(): Promise<void> {
    if (client) {
        await disconnect()
    }
    await connect()
}

async function listTools(): Promise<void> {
    if (!client) {
        console.log('Not connected to server.')
        return
    }

    try {
        const toolsRequest: ListToolsRequest = {
            method: 'tools/list',
            params: {},
        }
        const toolsResult = await client.request(
            toolsRequest,
            ListToolsResultSchema
        )

        console.log('Available tools:')
        if (toolsResult.tools.length === 0) {
            console.log('  No tools available')
        } else {
            for (const tool of toolsResult.tools) {
                console.log(`  - ${tool.name}: ${tool.description}`)
            }
        }
    } catch (error) {
        console.log(`Tools not supported by this server (${error})`)
    }
}

async function listRules(isActive?: boolean): Promise<void> {
    if (!client) {
        console.log('Not connected to server.')
        return
    }

    try {
        // Call the list_rules tool with isActive parameter
        const args: Record<string, unknown> = {}
        if (isActive !== undefined) {
            args.isActive = isActive
        }

        console.log(
            `Fetching API Linter rules${isActive !== undefined ? ` (isActive=${isActive})` : ''}...`
        )
        await callTool('list_rules', args)
    } catch (error) {
        console.log(`Error listing API Linter rules: ${error}`)
    }
}

async function validateApi(filename: string): Promise<void> {
    if (!client) {
        console.log('Not connected to server.')
        return
    }

    try {
        // Read the API specification file
        const filePath = path.resolve(filename)
        console.log(`Reading API specification from ${filePath}`)

        const fileContent = await fs.readFile(filePath, 'utf8')
        console.log(`File loaded (${fileContent.length} bytes)`)

        // Call the validate_api_specification tool with the file content
        await callTool('validate_api_specification', {
            spec: fileContent,
        })
    } catch (error) {
        console.log(`Error validating API specification: ${error}`)
    }
}

async function validateApiWithRules(
    filename: string,
    ruleIds: string[]
): Promise<void> {
    if (!client) {
        console.log('Not connected to server.')
        return
    }

    try {
        // Read the API specification file
        const filePath = path.resolve(filename)
        console.log(`Reading API specification from ${filePath}`)

        const fileContent = await fs.readFile(filePath, 'utf8')
        console.log(`File loaded (${fileContent.length} bytes)`)

        // Call the validate_api_specification tool with the file content and rule IDs
        console.log(`Validating with specific rules: ${ruleIds.join(', ')}`)
        await callTool('validate_api_specification', {
            spec: fileContent,
            ruleIds: ruleIds,
        })
    } catch (error) {
        console.log(`Error validating API specification: ${error}`)
    }
}

async function callTool(
    name: string,
    args: Record<string, unknown>
): Promise<void> {
    if (!client) {
        console.log('Not connected to server.')
        return
    }

    try {
        const request: CallToolRequest = {
            method: 'tools/call',
            params: {
                name,
                arguments: args,
            },
        }

        console.log(`Calling tool '${name}' with args:`, args)
        const onLastEventIdUpdate = (event: string) => {
            notificationsToolLastEventId = event
        }
        const result = await client.request(request, CallToolResultSchema, {
            resumptionToken: notificationsToolLastEventId,
            onresumptiontoken: onLastEventIdUpdate,
        })

        console.log('Tool result:')
        result.content.forEach((item) => {
            if (item.type === 'text') {
                console.log(`  ${item.text}`)
            } else {
                console.log(`  ${item.type} content:`, item)
            }
        })
    } catch (error) {
        console.log(`Error calling tool ${name}: ${error}`)
    }
}

async function listPrompts(): Promise<void> {
    if (!client) {
        console.log('Not connected to server.')
        return
    }

    try {
        const promptsRequest: ListPromptsRequest = {
            method: 'prompts/list',
            params: {},
        }
        const promptsResult = await client.request(
            promptsRequest,
            ListPromptsResultSchema
        )
        console.log('Available prompts:')
        if (promptsResult.prompts.length === 0) {
            console.log('  No prompts available')
        } else {
            for (const prompt of promptsResult.prompts) {
                console.log(`  - ${prompt.name}: ${prompt.description}`)
            }
        }
    } catch (error) {
        console.log(`Prompts not supported by this server (${error})`)
    }
}

async function getPrompt(
    name: string,
    args: Record<string, unknown>
): Promise<void> {
    if (!client) {
        console.log('Not connected to server.')
        return
    }

    try {
        const promptRequest: GetPromptRequest = {
            method: 'prompts/get',
            params: {
                name,
                arguments: args as Record<string, string>,
            },
        }

        const promptResult = await client.request(
            promptRequest,
            GetPromptResultSchema
        )
        console.log('Prompt template:')
        promptResult.messages.forEach((msg, index) => {
            console.log(`  [${index + 1}] ${msg.role}: ${msg.content.text}`)
        })
    } catch (error) {
        console.log(`Error getting prompt ${name}: ${error}`)
    }
}

async function listResources(): Promise<void> {
    if (!client) {
        console.log('Not connected to server.')
        return
    }

    try {
        const resourcesRequest: ListResourcesRequest = {
            method: 'resources/list',
            params: {},
        }
        const resourcesResult = await client.request(
            resourcesRequest,
            ListResourcesResultSchema
        )

        console.log('Available resources:')
        if (resourcesResult.resources.length === 0) {
            console.log('  No resources available')
        } else {
            for (const resource of resourcesResult.resources) {
                console.log(`  - ${resource.name}: ${resource.uri}`)
            }
        }
    } catch (error) {
        console.log(`Resources not supported by this server (${error})`)
    }
}

async function cleanup(): Promise<void> {
    if (client && transport) {
        try {
            // First try to terminate the session gracefully
            if (transport.sessionId) {
                try {
                    console.log('Terminating session before exit...')
                    await transport.terminateSession()
                    console.log('Session terminated successfully')
                } catch (error) {
                    console.error('Error terminating session:', error)
                }
            }

            // Then close the transport
            await transport.close()
        } catch (error) {
            console.error('Error closing transport:', error)
        }
    }

    process.stdin.setRawMode(false)
    readline.close()
    console.log('\nGoodbye!')
    process.exit(0)
}

// Set up raw mode for keyboard input to capture Escape key
process.stdin.setRawMode(true)
process.stdin.on('data', async (data) => {
    // Check for Escape key (27)
    if (data.length === 1 && data[0] === 27) {
        console.log('\nESC key pressed. Disconnecting from server...')

        // Abort current operation and disconnect from server
        if (client && transport) {
            await disconnect()
            console.log('Disconnected. Press Enter to continue.')
        } else {
            console.log('Not connected to server.')
        }

        // Re-display the prompt
        process.stdout.write('> ')
    }
})

// Handle Ctrl+C
process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT. Cleaning up...')
    await cleanup()
})

// Start the interactive client
main().catch((error: unknown) => {
    console.error('Error running MCP client:', error)
    process.exit(1)
})
