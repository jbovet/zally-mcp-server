import client from 'prom-client'

// Create a Registry to register metrics
const register = new client.Registry()

// Add default metrics
client.collectDefaultMetrics({ register })

// HTTP request duration metric
const httpRequestDurationMicroseconds = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
})

// HTTP request counter
const httpRequestCounter = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
})

// Error counter
const errorCounter = new client.Counter({
    name: 'errors_total',
    help: 'Total number of errors',
    labelNames: ['type'], // 'client', 'server', 'network'
})

// MCP Resource metrics
const mcpResourceGauge = new client.Gauge({
    name: 'mcp_resources',
    help: 'Current number of MCP resources available',
    labelNames: ['type', 'status'], // resource type and status
})

// MCP Tool invocation metrics
const mcpToolInvocationCounter = new client.Counter({
    name: 'mcp_tool_invocations_total',
    help: 'Total number of MCP tool invocations',
    labelNames: ['tool', 'status'], // tool name and status (success/failure)
})

// MCP Tool duration metric
const mcpToolDurationMicroseconds = new client.Histogram({
    name: 'mcp_tool_duration_seconds',
    help: 'Duration of MCP tool executions in seconds',
    labelNames: ['tool', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30],
})

// Use a counter instead of a gauge
const mcpRequestCounter = new client.Counter({
    name: 'mcp_requests_total',
    help: 'Total number of MCP client requests',
    labelNames: ['transport', 'status'],
})

// Register metrics
register.registerMetric(httpRequestDurationMicroseconds)
register.registerMetric(httpRequestCounter)
register.registerMetric(errorCounter)
register.registerMetric(mcpResourceGauge)
register.registerMetric(mcpToolInvocationCounter)
register.registerMetric(mcpToolDurationMicroseconds)
register.registerMetric(mcpRequestCounter)

// Export metrics service
export const Metrics = {
    // Get metrics in Prometheus format
    getMetrics: async () => {
        return register.metrics()
    },

    // Reset metrics
    resetMetrics: async () => {
        register.clear()
        client.collectDefaultMetrics({ register })
    },

    // Record HTTP request
    recordHttpRequest: (
        method: string,
        route: string,
        statusCode: number,
        durationMs: number
    ) => {
        httpRequestCounter.inc({ method, route, status_code: statusCode })
        httpRequestDurationMicroseconds.observe(
            { method, route, status_code: statusCode },
            durationMs / 1000 // Convert to seconds
        )
    },

    // Record error
    recordError: (type: 'client' | 'server' | 'network') => {
        errorCounter.inc({ type })
    },

    // Record MCP tools
    recordMcpTool: (
        tool: string,
        status: 'success' | 'failure',
        durationMs: number
    ) => {
        mcpToolInvocationCounter.inc({ tool, status })
        mcpToolDurationMicroseconds.observe(
            { tool, status },
            durationMs / 1000 // Convert to seconds
        )
    },

    // Update MCP resource counts
    updateMcpResourceCount: (type: string, status: string, count: number) => {
        mcpResourceGauge.set({ type, status }, count)
    },

    // Increment MCP tool invocation counter
    incrementMcpToolInvocation: (
        tool: string,
        status: 'success' | 'failure'
    ) => {
        mcpToolInvocationCounter.inc({ tool, status })
    },

    // Record MCP tool execution duration
    recordMcpToolDuration: (
        tool: string,
        status: 'success' | 'failure',
        durationMs: number
    ) => {
        mcpToolDurationMicroseconds.observe(
            { tool, status },
            durationMs / 1000 // Convert to seconds
        )
    },

    // Record MCP request
    recordMcpRequest: (transport: string, status: 'success' | 'error') => {
        mcpRequestCounter.inc({ transport, status })
    },
}
