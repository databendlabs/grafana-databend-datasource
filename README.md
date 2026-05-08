# Grafana Databend Data Source Plugin

The Databend data source plugin for Grafana allows you to visualize data from [Databend](https://databend.com) in Grafana.

Supports both **Databend** (self-hosted) and **Databend Cloud**.

## Features

- **SQL Editor** — Full SQL query editor with Monaco, macro support, and template variables
- **Query Builder** — Visual query builder with database/table/column selectors, filters, aggregation, and ordering
- **Metrics** — Time series visualization with `$__timeInterval` macro
- **Logs** — Native logs support with configurable time/level/message columns
- **Traces** — Native traces support with configurable span/trace ID columns
- **Alerting** — Grafana alerting support
- **Annotations** — Query-based annotations

## Configuration

Connect using a DSN (Data Source Name):

```
databend://user:password@host:8000/database?sslmode=disable
```

### Logs Schema

Configure default table and column mappings for log queries:

| Setting | Description | Default |
|---------|-------------|---------|
| Default Table | Table containing logs | `otel_logs` |
| Time Column | Timestamp column | `timestamp` |
| Level Column | Log level column | `level` |
| Message Column | Log message column | `message` |

### Traces Schema

Configure default table and column mappings for trace queries:

| Setting | Description | Default |
|---------|-------------|---------|
| Default Table | Table containing traces | `otel_traces` |
| Trace ID Column | Trace ID column | `trace_id` |
| Span ID Column | Span ID column | `span_id` |
| Operation Name | Operation name column | `operation_name` |
| Service Name | Service name column | `service_name` |
| Duration Column | Duration column | `duration` |
| Start Time Column | Start time column | `timestamp` |

## Macros

| Macro | Description | Example Output |
|-------|-------------|----------------|
| `$__timeFilter(col)` | Time range filter | `col >= '2024-01-01 00:00:00' AND col <= '2024-01-02 00:00:00'` |
| `$__timeFilter_ms(col)` | Time range filter (ms precision) | Same with milliseconds |
| `$__dateFilter(col)` | Date-only filter | `col >= '2024-01-01' AND col <= '2024-01-02'` |
| `$__fromTime` | Start of time range | `'2024-01-01 00:00:00'` |
| `$__toTime` | End of time range | `'2024-01-02 00:00:00'` |
| `$__timeInterval(col)` | Time-bucketed column | `DATE_TRUNC('minute', col)` |
| `$__timeInterval_ms(col)` | Time-bucketed column (ms) | `TO_TIMESTAMP(...)` |
| `$__interval_s` | Dashboard interval in seconds | `60` |

## Building

### Prerequisites

- Go 1.24+
- Node.js 24+
- pnpm 10+
- [Mage](https://magefile.org/)

### Frontend

```bash
pnpm install
pnpm build
```

### Backend

```bash
mage -v
```

### Development

```bash
make preview
```

This starts Databend and Grafana via Docker Compose with the plugin pre-configured.

## License

Apache License 2.0
