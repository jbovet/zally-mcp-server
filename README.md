# APILinter MCP Server

The OpenAPI MCP Server powers seamless communication between LLM and REST APIs by implementing the Model Context Protocol (MCP).

## Features

| Capability | Implemented | Notes |
|-----------------------|-------------|-------|
| **Structured Logging** |  ✅  |  |
| **Metrics & Monitoring** |  ✅  |  |
| **Circuit Breakers** |  ✅  |  |
| **Retry Pattern** |  ✅  |  |
| **Health Checks** |  ✅  |  |
| **API Documentation** | ❌ |  Planning |
| **Rate Limiting** | ❌ | Planning   |
| **Security Controls** | ❌ |  |
| **Error Handling** |  ✅  |  |
| **OpenTelemtry** | ❌ | Planning  |

## MCP Protocol Compliance

| Feature | Implemented | Notes |
|---------|-------------|-------|
| **Protocol Specification** |  ✅  |  v2025-03-26 |
| **MCP Authentication** | ❌ | not necessary |
| **Session Managment** |  ❌  |  Stateless |
| **Tools Support** | ✅ | `validate_api_specification` `list_rules` `calculate_api_quality_score` `get_rule_categories` `get_api_docs` `get_api_linter_link` |
| **Resources Support** | ❌ |  |
| **Prompts Support** | ✅ | `api_design_review` |
| **Streamable HTTP Transport** | ✅ | |
| **SSE Transport** | ❌ | not planing |
| **STDIO Transport** | ❌ | not planing |
| **SDK Client** | ✅ | <https://github.com/jbovet/zally-mcp-server.git> |

## Installation

1. Clone the repository:

```bash
   git clone git@github.com:jbovet/zally-mcp-server.git
   cd zally-mcp-server
```

Project Structure:

- ```src/```: Contains the TypeScript source code.
  - ```circuitbreaker/```: Circuitr breaker and retry implementation.
  - ```config/```: Configuration files.
  - ```controllers/```: Express controllers, including the StreamableHttp controller.
  - ```models/```: TypeScript interfaces for data models.
  - ```repositories/```: Data access layer for API Linter.
  - ```services/```: Business logic for API Linter and MCP integration.
  - ```utils/```: Utility classes, including HTTP clients and error handling.
  - ```target/```: Compiled JavaScript files.
- ```package.json```: Project metadata and dependencies.
- ```tsconfig.json```: TypeScript configuration file.
- ```curl-mcp-client.sh```: Bash script to test MCP server endpoints via curl.
- ```README.md```: Project documentation.

1. Install dependencies:

```bash
npm install
```

2. Build the project:

```bash
npm run build
```

## Configuration

Environment variables:

- `PORT`: Server port (default: 8080)
- `APILINTER_URL`: API Linter service URL (default: <http://localhost:8080>)
- `RETRY_COUNT`: Number of retry attempts for failed requests (default: 3)
- `CIRCUIT_BREAKER_THRESHOLD`: Failure threshold to trigger the circuit breaker (default: 5)

## Running the Server

> **_NOTE:_**  before, you  need run Zally Server, you can check the doc here <https://github.com/zalando/zally?tab=readme-ov-file#quick-start-guide>

Start the server with:

```bash
npm run dev
```

The MCP Server will run in Streamable HTTP mode on endpoint: <http://localhost:8080/mcp>

## Testing the Server

Run the tests with:

```bash
npm run test
```

## Running the Example Client

To run the example interactive client for the MCP server, use the following command:

```bash
npx tsx example/simpleStreamableHttp.ts
```

This will start the interactive client, allowing you to test various commands and features of the MCP server.

```bash
> list-rules
> list-rules true
> validate-api ./my-api-spec.yaml
> validate-api-rules ./my-api-spec.json id
```

## Tools

The MCP server provides the following tools for API Linting:

- `validate_api_specification`: Validates an API specification (OpenAPI/Swagger) against API Linter rules
  - Parameters: `spec` (API specification content), `ruleIds` (optional list of rule IDs to use)
  - Returns: Validation results with violations and formatting
  - **Retry Logic**: Retries validation requests in case of transient failures
  - **Circuit Breaker**: Stops validation requests if the API Linter service becomes unresponsive

- `list_rules`: Lists all available API Linter rules
  - Parameters: `isActive` (optional boolean to filter by active status)
  - Returns: List of available linting rules with their details
  - **Retry Logic**: Retries rule listing requests in case of transient failures
  - **Circuit Breaker**: Prevents further requests if the API Linter service exceeds failure thresholds

- `calculate_api_quality_score`: Calculates the quality score of an API specification
  - Parameters: `spec` (API specification content)
  - Returns: Quality score with detailed breakdown

- `get_rule_categories`: Retrieves the categories of API Linter rules
  - Parameters: None
  - Returns: List of rule categories

- `get_api_docs`: Retrieves the API documentation
  - Parameters: None
  - Returns: API documentation content

- `get_api_linter_link`: Retrieves the link to the API Linter service
  - Parameters: None
  - Returns: API Linter service link

## Prompts

The MCP server provides the following pre-configured prompts:

- `api_design_review`: Analyzes an API specification and provides comprehensive design feedback
  - Parameters:
    - `specification` (API specification content in JSON or YAML format)
    - `focusAreas` (optional comma-separated list of areas to focus on, e.g., "security,naming,consistency")
  - Returns: Structured API design feedback including:
    - Executive summary of API purpose and design
    - Strengths identification
    - Areas for improvement (naming, consistency, error handling, security, etc.)
    - Specific recommendations for API enhancement

## Security Notes

- Implements origin validation to prevent DNS rebinding attacks
- Uses Streamable HTTP transport in stateless mode for security
- Only processes requests from trusted origins (localhost) in development
- All API inputs are validated before processing
- **Retry Logic and Circuit Breaker**: Enhance resilience and security by handling service failures gracefully

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

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.