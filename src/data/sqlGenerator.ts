import {
  QueryBuilderOptions,
  BuilderMode,
  AggregateType,
  ColumnHint,
  Filter,
} from 'types/queryBuilder';

export function generateSql(options: QueryBuilderOptions): string {
  const { database, table, mode, columns, aggregates, groupBy, filters, orderBy, limit } = options;

  if (!table) {
    return '';
  }

  const parts: string[] = [];
  const tableRef = database ? `${database}.${table}` : table;

  // SELECT
  const selectParts: string[] = [];

  if (mode === BuilderMode.Aggregate || mode === BuilderMode.Trend) {
    // Group by columns
    if (groupBy && groupBy.length > 0) {
      selectParts.push(...groupBy);
    }
    // Time column for trend
    if (mode === BuilderMode.Trend) {
      const timeCol = columns.find(c => c.hint === ColumnHint.Time);
      if (timeCol) {
        selectParts.push(`$__timeInterval(${timeCol.name})`);
      }
    }
    // Aggregates
    if (aggregates && aggregates.length > 0) {
      for (const agg of aggregates) {
        const aggExpr = agg.aggregateType === AggregateType.Count
          ? `count(${agg.column || '*'})`
          : `${agg.aggregateType}(${agg.column})`;
        selectParts.push(agg.alias ? `${aggExpr} AS ${agg.alias}` : aggExpr);
      }
    }
  } else {
    // List mode
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
  const whereParts: string[] = [];
  if (filters && filters.length > 0) {
    for (const filter of filters) {
      const filterSql = buildFilterSql(filter);
      if (filterSql) {
        whereParts.push(filterSql);
      }
    }
  }
  // Add time filter for time series
  const timeCol = columns.find(c => c.hint === ColumnHint.Time);
  if (timeCol && (mode === BuilderMode.Trend || options.queryType === 'timeseries')) {
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
    const orderParts = orderBy.map(o => `${o.name} ${o.dir}`);
    parts.push(`ORDER BY ${orderParts.join(', ')}`);
  } else if (mode === BuilderMode.Trend && timeCol) {
    parts.push(`ORDER BY $__timeInterval(${timeCol.name}) ASC`);
  }

  // LIMIT
  if (limit && limit > 0) {
    parts.push(`LIMIT ${limit}`);
  }

  return parts.join('\n');
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
        return `${key} ${operator} (${value.map(v => `'${v}'`).join(', ')})`;
      }
      return `${key} ${operator} ('${value}')`;
    default:
      if (typeof value === 'number') {
        return `${key} ${operator} ${value}`;
      }
      return `${key} ${operator} '${value}'`;
  }
}
