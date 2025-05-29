import { ApiLinterMcpClient } from '../src/index'
import fs from 'fs/promises'
import path from 'path'

/**
 * Example demonstrating use of the API Linter Client SDK
 *
 * This example shows:
 * 1. Connecting to the API Linter MCP server
 * 2. Validating an API specification
 * 3. Listing available linting rules
 * 4. Getting an API design reviewnpm run example
 */
async function main() {
    // Create an API Linter client with debug mode enabled
    const client = new ApiLinterMcpClient('http://localhost:3000/mcp', {
        debug: true,
        timeout: 30000, // 30 seconds timeout
        clientName: 'example-client',
        clientVersion: '1.0.0',
    })

    // Set up notification listener
    const removeListener = client.onNotification((level, message) => {
        console.log(`[${level.toUpperCase()}] ${message}`)
    })

    try {
        // Step 1: Connect to the API Linter MCP server
        console.log('Connecting to API Linter MCP server...')
        await client.connect()
        console.log('Connected successfully!')
        console.log(
            'Connection status:',
            client.getConnectionStatus() ? 'Connected' : 'Disconnected'
        )

        // Step 2: Read an API specification from file
        // You can replace this with your own API specification
        console.log('\nReading sample API specification...')
        const specFilePath = path.join(__dirname, 'sample-api-spec.yaml')
        let apiSpec

        try {
            apiSpec = await fs.readFile(specFilePath, 'utf8')
            console.log(
                `Loaded API specification (${apiSpec.length} characters)`
            )
        } catch (error) {
            console.log(
                'Sample API specification file not found, using a minimal example instead'
            )
            // Use a minimal OpenAPI specification as fallback
            apiSpec = `
openapi: 3.0.0
info:
  title: Sample API
  version: 1.0.0
paths:
  /example:
    get:
      summary: Get an example
      responses:
        '200':
          description: OK
      `
        }

        // Step 3: Validate the API specification
        console.log('\n=== Validating API Specification ===')
        const validationResult = await client.validateApiSpecification(apiSpec)

        console.log(`Validation message: ${validationResult.message}`)
        console.log(`Found ${validationResult.violationCount} violations`)

        if (validationResult.violations.length > 0) {
            console.log('\nTop violations:')
            validationResult.violations.slice(0, 3).forEach((violation) => {
                console.log(`- [${violation.type}] ${violation.title}`)
                console.log(`  Description: ${violation.description}`)
                if (violation.path) {
                    console.log(`  Location: ${violation.path}`)
                }
                console.log('')
            })
        }

        // Step 4: List available rules
        console.log('\n=== Listing API Linting Rules ===')
        const rules = await client.listRules()

        console.log(`Found ${rules.length} rules`)
        if (rules.length > 0) {
            console.log('\nSample rules:')
            rules.slice(0, 3).forEach((rule) => {
                console.log(`- ${rule.title} (ID: ${rule.wmRuleId})`)
                if (rule.url) {
                    console.log(`  Documentation: ${rule.url}`)
                }
                console.log('')
            })
        }

        // Step 5: Get an API design review
        console.log('\n=== Getting API Design Review ===')
        const focusAreas = 'security,naming,consistency'
        console.log(`Generating review with focus on: ${focusAreas}`)

        const review = await client.getApiDesignReview(apiSpec, focusAreas)

        console.log(`Review contains ${review.messages.length} messages`)
        if (review.messages.length > 0) {
            console.log('\nReview messages:')
            review.messages.forEach((msg, index) => {
                console.log(`\n[Message ${index + 1} - ${msg.role}]`)
                // Print the first 150 characters of each message for brevity
                const previewText =
                    msg.content.length > 150
                        ? msg.content.substring(0, 150) + '...'
                        : msg.content
                console.log(previewText)
            })

            console.log(
                '\nThis review prompt can now be sent to an LLM for detailed analysis.'
            )
        }
    } catch (error) {
        console.error('Error:', error)
    } finally {
        // Clean up
        console.log('\nPerforming cleanup...')

        // Remove notification listener
        removeListener()

        // Terminate session
        try {
            await client.terminateSession()
            console.log('Session terminated')
        } catch (error) {
            console.log(
                'Session termination not supported by server (this is normal for some servers)'
            )
        }

        // Disconnect from server
        await client.disconnect()
        console.log('Disconnected from API Linter MCP server')
    }
}

// Run the example
main().catch((error) => {
    console.error('Unhandled error:', error)
    process.exit(1)
})
