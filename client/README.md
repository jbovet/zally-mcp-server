# API Linter MCP Client

A TypeScript client library for interacting with the API Linter service via the Model Context Protocol (MCP).

## Overview

This client allows you to easily integrate with API Linter services that expose their functionality through the Model Context Protocol (MCP). It provides a simple, type-safe interface to:

- Validate API specifications against linting rules
- List available linting rules
- Get AI-powered API design reviews

## Installation

//TODO

Note: This library has a peer dependency on `@modelcontextprotocol/sdk`. If you don't already have it installed, you'll need to add it:

```bash
npm install @modelcontextprotocol/sdk
```

## Basic Usage

```typescript
import { ApiLinterMcpClient } from 'api-linter-mcp-client'

// Create a client instance
const client = new ApiLinterMcpClient('http://localhost:3000/mcp', {
    debug: true,
    timeout: 30000, // 30 seconds timeout
})

// Connect to the server
await client.connect()

// Validate an API specification
const specContent = '...' // Your OpenAPI/Swagger content
const result = await client.validateApiSpecification(specContent)

console.log(`Validation result: ${result.message}`)
console.log(`Found ${result.violationCount} violations`)

// List available rules
const rules = await client.listRules()
console.log(`Found ${rules.length} rules`)

// Get an API design review
const review = await client.getApiDesignReview(specContent, 'security,naming')
console.log('API Design Review prompt generated')

// Disconnect when done
await client.disconnect()
```

## Advanced Features

### Listening for Notifications

The client can receive notifications from the server about the validation process or other events:

```typescript
const removeListener = client.onNotification((level, message) => {
    console.log(`[${level.toUpperCase()}] ${message}`)
})

// When you're done listening:
removeListener()
```

### Session Management

For explicit cleanup of server resources, you can terminate the session:

```typescript
await client.terminateSession()
```

### Error Handling

The client wraps internal errors with descriptive messages:

```typescript
try {
    await client.validateApiSpecification(specContent)
} catch (error) {
    console.error('Validation error:', error.message)
}
```

## Development

### Building the Library

```bash
# Install dependencies
npm install

# Build the library
npm run build
```

### Running Tests

The library includes a comprehensive test suite built with Jest:

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm test -- --watch
```

### Running the Example

To see a practical example of using the client:

```bash
# Run the example script
npm run example
```

This will connect to a local API Linter MCP server (if available) and demonstrate the main features of the client.

## API Reference

### `ApiLinterMcpClient`

#### Constructor

```typescript
constructor(
  serverUrl: string = 'http://localhost:3000/mcp',
  options?: {
    clientName?: string;
    clientVersion?: string;
    timeout?: number;
    debug?: boolean;
  }
)
```

#### Methods

- `connect(): Promise<void>` - Connects to the API Linter MCP server
- `disconnect(): Promise<void>` - Disconnects from the server
- `getConnectionStatus(): boolean` - Checks if the client is connected
- `onNotification(listener: (level: string, message: string) => void): () => void` - Registers a notification listener
- `validateApiSpecification(specContent: string, ruleIds?: string[]): Promise<ApiLinterValidationResult>` - Validates an API specification
- `listRules(): Promise<ApiLinterRule[]>` - Lists all available API linting rules
- `getApiDesignReview(specContent: string, focusAreas?: string): Promise<ApiDesignReviewResult>` - Gets an AI-powered design review
- `terminateSession(): Promise<void>` - Terminates the current session with the server

### Types

#### `ApiLinterValidationResult`

```typescript
interface ApiLinterValidationResult {
    message: string
    violations: ApiLinterViolation[]
    violationCount: number
    validationSuccess?: boolean
    rawContent?: string
}
```

#### `ApiLinterViolation`

```typescript
interface ApiLinterViolation {
    index: number
    title: string
    description: string
    path: string
    type: string
    startLine?: number
    endLine?: number
}
```

#### `ApiLinterRule`

```typescript
interface ApiLinterRule {
    title: string
    wmRuleId: string
    type?: string
    url?: string
    isActive?: boolean
}
```

#### `ApiDesignReviewResult`

```typescript
interface ApiDesignReviewResult {
    messages: Array<{
        role: string
        content: string
    }>
}
```

## Troubleshooting

### Common Issues

1. **Connection failures**: Ensure the API Linter MCP server is running and accessible at the specified URL.

2. **Timeout errors**: For large API specifications, you may need to increase the timeout value when creating the client.

3. **Session termination fails**: Some servers don't support session termination. This is not an error, and the client will handle it gracefully.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Install dependencies (`npm install`)
4. Make your changes
5. Run tests to ensure they pass (`npm test`)
6. Commit your changes (`git commit -m 'Add some amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## License

MIT
