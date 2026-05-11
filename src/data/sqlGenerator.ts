import {
  QueryBuilderOptions,
  BuilderMode,
  AggregateType,
  ColumnHint,
  Filter,
  SelectedColumn,
} from 'types/queryBuilder';

export function generateSql(options: QueryBuilderOptions): string {
  const { table, queryType } = options;
  if (!table) {
    return '';
  }

  // Special handling for trace-id detail mode: look up a single trace's spans
  if (queryType === 'traces' && options.meta?.isTraceIdMode) {
    return generateTraceIdSql(options);
  }

  // Special handling for traces search: shape columns for trace list visualization
  if (queryType === 'traces') {
    return generateTracesSearchSql(options);
  }

  // Special handling for logs
  if (queryType === 'logs') {
    return generateLogsSql(options);
  }

  return generateGenericSql(options);
}

/**
 * Generic SQL generator for table, timeseries, and aggregate/trend modes.
 */
function generateGenericSql(options: QueryBuilderOptions): string {
  const { database, table, mode, columns, aggregates, groupBy, filters, orderBy, limit, queryType } = options;

  const parts: string[] = [];
  const tableRef = database ? `${database}.${table}` : table;

  // SELECT
  const selectParts: string[] = [];
  if (mode === BuilderMode.Aggregate || mode === BuilderMode.Trend) {
    if (groupBy && groupBy.length > 0) {
      selectParts.push(...groupBy);
    }
    if (mode === BuilderMode.Trend) {
      const timeCol = columns.find((c) => c.hint === ColumnHint.Time);
      if (timeCol) {
        selectParts.push(`$__timeInterval(${timeCol.name}) AS time`);
      }
    }
    if (aggregates && aggregates.length > 0) {
      for (const agg of aggregates) {
        const aggExpr =
          agg.aggregateType === AggregateType.Count
            ? `count(${agg.column || '*'})`
            : `${agg.aggregateType}(${agg.column})`;
        selectParts.push(agg.alias ? `${aggExpr} AS ${agg.alias}` : aggExpr);
      }
    }
  } else {
    if (columns.length > 0) {
      for (const col of columns) {
        selectParts.push(col.alias ? `${col.name} AS ${col.alias}` : col.name);
      }
    } else {
      selectParts.push('*');
    }
  }

  parts.push(`SELECT ${selectParts.join(', ')}`);
  parts.push(`FROM ${tableRef}`);

  // WHERE
  const whereParts: string[] = buildWhereClauses(filters);
  const timeCol = columns.find((c) => c.hint === ColumnHint.Time);
  if (timeCol && (mode === BuilderMode.Trend || queryType === 'timeseries')) {
    whereParts.push(`$__timeFilter(${timeCol.name})`);
  }
  if (whereParts.length > 0) {
    parts.push(`WHERE ${whereParts.join(' AND ')}`);
  }

  // GROUP BY
  if (mode === BuilderMode.Aggregate || mode === BuilderMode.Trend) {
    const groupByParts: string[] = [];
    if (groupBy && groupBy.length > 0) {
      groupByParts.push(...groupBy);
    }
    if (mode === BuilderMode.Trend && timeCol) {
      groupByParts.push(`$__timeInterval(${timeCol.name})`);
    }
    if (groupByParts.length > 0) {
      parts.push(`GROUP BY ${groupByParts.join(', ')}`);
    }
  }

  // ORDER BY
  if (orderBy && orderBy.length > 0) {
    parts.push(`ORDER BY ${orderBy.map((o) => `${o.name} ${o.dir}`).join(', ')}`);
  } else if (mode === BuilderMode.Trend && timeCol) {
    parts.push(`ORDER BY $__timeInterval(${timeCol.name}) ASC`);
  }

  // LIMIT
  if (limit && limit > 0) {
    parts.push(`LIMIT ${limit}`);
  }

  return parts.join('\n');
}

/**
 * Logs SQL generator. Always applies time filter on the time column
 * and orders by time DESC unless the user overrides.
 */
function generateLogsSql(options: QueryBuilderOptions): string {
  const { database, table, columns, filters, orderBy, limit } = options;

  const parts: string[] = [];
  const tableRef = database ? `${database}.${table}` : table;

  const timeCol = columns.find((c) => c.hint === ColumnHint.Time);

  // SELECT
  const selectParts: string[] = [];
  if (columns.length > 0) {
    for (const col of columns) {
      selectParts.push(formatColumn(col));
    }
  } else {
    selectParts.push('*');
  }

  parts.push(`SELECT ${selectParts.join(', ')}`);
  parts.push(`FROM ${tableRef}`);

  const whereParts = buildWhereClauses(filters);
  if (timeCol) {
    whereParts.push(`$__timeFilter(${timeCol.name})`);
  }
  if (whereParts.length > 0) {
    parts.push(`WHERE ${whereParts.join(' AND ')}`);
  }

  if (orderBy && orderBy.length > 0) {
    parts.push(`ORDER BY ${orderBy.map((o) => `${o.name} ${o.dir}`).join(', ')}`);
  } else if (timeCol) {
    parts.push(`ORDER BY ${timeCol.name} DESC`);
  }

  parts.push(`LIMIT ${limit && limit > 0 ? limit : 1000}`);
  return parts.join('\n');
}

/**
 * Traces SEARCH SQL generator. Builds a list of traces, grouped by traceID,
 * so Grafana renders the trace search result view.
 */
function generateTracesSearchSql(options: QueryBuilderOptions): string {
  const { database, table, columns, filters, orderBy, limit } = options;

  const parts: string[] = [];
  const tableRef = database ? `${database}.${table}` : table;

  const traceIdCol = columns.find((c) => c.hint === ColumnHint.TraceId);
  const serviceCol = columns.find((c) => c.hint === ColumnHint.TraceServiceName);
  const operationCol = columns.find((c) => c.hint === ColumnHint.TraceOperationName);
  const durationCol = columns.find((c) => c.hint === ColumnHint.TraceDurationTime);
  const startTimeCol = columns.find((c) => c.hint === ColumnHint.Time);

  const durationUnit = (options.meta?.traceDurationUnit as string) || 'ms';

  const selectParts: string[] = [];
  if (traceIdCol) {
    selectParts.push(`${traceIdCol.name} AS traceID`);
  }
  if (startTimeCol) {
    selectParts.push(`min(${startTimeCol.name}) AS startTime`);
  }
  if (serviceCol) {
    selectParts.push(`any(${serviceCol.name}) AS serviceName`);
  }
  if (operationCol) {
    selectParts.push(`any(${operationCol.name}) AS operationName`);
  }
  if (durationCol) {
    selectParts.push(`${convertDuration(`sum(${durationCol.name})`, durationUnit)} AS duration`);
  }

  if (selectParts.length === 0) {
    return generateGenericSql(options);
  }

  parts.push(`SELECT ${selectParts.join(', ')}`);
  parts.push(`FROM ${tableRef}`);

  const whereParts = buildWhereClauses(filters);
  if (startTimeCol) {
    whereParts.push(`$__timeFilter(${startTimeCol.name})`);
  }
  if (whereParts.length > 0) {
    parts.push(`WHERE ${whereParts.join(' AND ')}`);
  }

  if (traceIdCol) {
    parts.push(`GROUP BY ${traceIdCol.name}`);
  }

  if (orderBy && orderBy.length > 0) {
    parts.push(`ORDER BY ${orderBy.map((o) => `${o.name} ${o.dir}`).join(', ')}`);
  } else {
    parts.push(`ORDER BY startTime DESC`);
  }

  parts.push(`LIMIT ${limit && limit > 0 ? limit : 100}`);
  return parts.join('\n');
}

/**
 * Trace-detail SQL generator: returns all spans for a single traceID
 * with the column shape expected by Grafana's trace viewer.
 */
function generateTraceIdSql(options: QueryBuilderOptions): string {
  const { database, table, columns } = options;
  const tableRef = database ? `${database}.${table}` : table;

  const traceIdCol = columns.find((c) => c.hint === ColumnHint.TraceId);
  const spanIdCol = columns.find((c) => c.hint === ColumnHint.TraceSpanId);
  const parentSpanIdCol = columns.find((c) => c.hint === ColumnHint.TraceParentSpanId);
  const serviceCol = columns.find((c) => c.hint === ColumnHint.TraceServiceName);
  const operationCol = columns.find((c) => c.hint === ColumnHint.TraceOperationName);
  const durationCol = columns.find((c) => c.hint === ColumnHint.TraceDurationTime);
  const startTimeCol = columns.find((c) => c.hint === ColumnHint.Time);
  const tagsCol = columns.find((c) => c.hint === ColumnHint.TraceTags);
  const serviceTagsCol = columns.find((c) => c.hint === ColumnHint.TraceServiceTags);
  const statusCodeCol = columns.find((c) => c.hint === ColumnHint.TraceStatusCode);
  const statusMessageCol = columns.find((c) => c.hint === ColumnHint.TraceStatusMessage);
  const kindCol = columns.find((c) => c.hint === ColumnHint.TraceKind);

  const durationUnit = (options.meta?.traceDurationUnit as string) || 'ms';
  const traceId = (options.meta?.traceId as string) || '';

  const selectParts: string[] = [];
  if (traceIdCol) {
    selectParts.push(`${traceIdCol.name} AS traceID`);
  }
  if (spanIdCol) {
    selectParts.push(`${spanIdCol.name} AS spanID`);
  }
  if (parentSpanIdCol) {
    selectParts.push(`${parentSpanIdCol.name} AS parentSpanID`);
  } else {
    selectParts.push(`'' AS parentSpanID`);
  }
  if (serviceCol) {
    selectParts.push(`${serviceCol.name} AS serviceName`);
  }
  if (operationCol) {
    selectParts.push(`${operationCol.name} AS operationName`);
  }
  if (startTimeCol) {
    selectParts.push(`TO_UNIX_TIMESTAMP(${startTimeCol.name}) * 1000 AS startTime`);
  }
  if (durationCol) {
    selectParts.push(`${convertDuration(durationCol.name, durationUnit)} AS duration`);
  }
  if (tagsCol) {
    selectParts.push(`${tagsCol.name} AS tags`);
  }
  if (serviceTagsCol) {
    selectParts.push(`${serviceTagsCol.name} AS serviceTags`);
  }
  if (statusCodeCol) {
    selectParts.push(`CASE WHEN ${statusCodeCol.name} IN ('Error', 'STATUS_CODE_ERROR') THEN 2 ELSE 0 END AS statusCode`);
  }
  if (statusMessageCol) {
    selectParts.push(`${statusMessageCol.name} AS statusMessage`);
  }
  if (kindCol) {
    selectParts.push(`${kindCol.name} AS kind`);
  }

  const parts: string[] = [];
  parts.push(`SELECT ${selectParts.join(', ')}`);
  parts.push(`FROM ${tableRef}`);

  const whereParts: string[] = [];
  if (traceIdCol && traceId) {
    whereParts.push(`${traceIdCol.name} = '${traceId}'`);
  }
  if (whereParts.length > 0) {
    parts.push(`WHERE ${whereParts.join(' AND ')}`);
  }

  if (startTimeCol) {
    parts.push(`ORDER BY ${startTimeCol.name} ASC`);
  }

  parts.push(`LIMIT 1000`);
  return parts.join('\n');
}

function formatColumn(col: SelectedColumn): string {
  return col.alias ? `${col.name} AS ${col.alias}` : col.name;
}

function buildWhereClauses(filters?: Filter[]): string[] {
  const out: string[] = [];
  if (!filters || filters.length === 0) {
    return out;
  }
  for (const filter of filters) {
    const sql = buildFilterSql(filter);
    if (sql) {
      out.push(sql);
    }
  }
  return out;
}

function convertDuration(expr: string, unit: string): string {
  // Grafana's trace viewer expects duration in milliseconds.
  switch (unit) {
    case 'ns':
      return `${expr} / 1000000`;
    case 'us':
      return `${expr} / 1000`;
    case 's':
      return `${expr} * 1000`;
    case 'ms':
    default:
      return expr;
  }
}

function buildFilterSql(filter: Filter): string {
  if (!filter.key || filter.operator === 'IS ANYTHING') {
    return '';
  }
  const { key, operator, value } = filter;
  switch (operator) {
    case 'IS NULL':
    case 'IS NOT NULL':
      return `${key} ${operator}`;
    case 'IN':
    case 'NOT IN':
      if (Array.isArray(value)) {
        return `${key} ${operator} (${value.map((v) => `'${v}'`).join(', ')})`;
      }
      return `${key} ${operator} ('${value}')`;
    default:
      if (typeof value === 'number') {
        return `${key} ${operator} ${value}`;
      }
      return `${key} ${operator} '${value}'`;
  }
}
