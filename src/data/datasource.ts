import {
  DataFrame,
  DataFrameView,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  DataSourceWithLogsContextSupport,
  DataSourceWithQueryModificationSupport,
  DataSourceWithSupplementaryQueriesSupport,
  LogRowContextOptions,
  LogRowContextQueryDirection,
  LogRowModel,
  MetricFindValue,
  QueryFixAction,
  ScopedVars,
  SupplementaryQueryType,
  TimeRange,
} from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime';
import { firstValueFrom, map, Observable } from 'rxjs';
import { DatabendConfig } from 'types/config';
import { DatabendQuery, EditorType, QueryType, queryTypeToFormat } from 'types/sql';
import { transformQueryResponseWithTraceAndLogLinks } from './utils';

const DEFAULT_AD_HOC_TAG_LIMIT = 1000;

export class DatabendDatasource
  extends DataSourceWithBackend<DatabendQuery, DatabendConfig>
  implements
    DataSourceWithSupplementaryQueriesSupport<DatabendQuery>,
    DataSourceWithLogsContextSupport<DatabendQuery>,
    DataSourceWithQueryModificationSupport<DatabendQuery>
{
  annotations = {
    prepareAnnotation,
    prepareQuery(anno: any): DatabendQuery | undefined {
      if (!anno?.target?.rawSql && !anno?.rawQuery) {
        return undefined;
      }
      return {
        refId: anno.name || 'Anno',
        rawSql: anno.target?.rawSql || anno.rawQuery || '',
        editorType: EditorType.SQL,
        format: queryTypeToFormat(QueryType.Table),
      } as DatabendQuery;
    },
  };
  settings: DataSourceInstanceSettings<DatabendConfig>;

  constructor(instanceSettings: DataSourceInstanceSettings<DatabendConfig>) {
    super(instanceSettings);
    this.settings = instanceSettings;
  }

  applyTemplateVariables(query: DatabendQuery, scopedVars: ScopedVars, filters?: any[]): DatabendQuery {
    const interpolated = this.replace(query.rawSql, scopedVars) || '';
    const withAdHoc = filters && filters.length > 0 ? applyAdHocFilters(interpolated, filters) : interpolated;
    return {
      ...query,
      rawSql: withAdHoc,
    };
  }
  replace(value?: string, scopedVars?: ScopedVars): string | undefined {
    if (value !== undefined) {
      return getTemplateSrv().replace(value, scopedVars, this.format);
    }
    return undefined;
  }

  format(value: string | string[]): string {
    if (Array.isArray(value)) {
      return value.map(v => `'${v}'`).join(',');
    }
    return value;
  }

  filterQuery(query: DatabendQuery): boolean {
    if (query.hide) {
      return false;
    }
    if (!query.rawSql) {
      return false;
    }
    return true;
  }

  query(request: DataQueryRequest<DatabendQuery>): Observable<DataQueryResponse> {
    return super.query(request).pipe(
      map((res: DataQueryResponse) => {
        return transformQueryResponseWithTraceAndLogLinks(this, request, res);
      })
    );
  }

  // Supplementary queries support (LogsVolume in Explore)
  getSupportedSupplementaryQueryTypes(): SupplementaryQueryType[] {
    return [SupplementaryQueryType.LogsVolume];
  }

  getSupplementaryQuery(
    options: { type: SupplementaryQueryType },
    originalQuery: DatabendQuery
  ): DatabendQuery | undefined {
    if (options.type !== SupplementaryQueryType.LogsVolume) {
      return undefined;
    }

    // Only generate volume query for logs queries
    if (originalQuery.queryType !== QueryType.Logs) {
      return undefined;
    }
    const jsonData = this.settings.jsonData;
    const db = jsonData.defaultDatabase || 'default';
    const logsTable = jsonData.logsTable || 'otel_logs';
    const tableRef = `${db}.${logsTable}`;
    const timeColumn = jsonData.logsTimeColumn || 'timestamp';
    const levelColumn = jsonData.logsLevelColumn || 'level';

    const rawSql = [
      `SELECT $__timeInterval(${timeColumn}) AS time,`,
      `       ${levelColumn} AS level,`,
      `       count(*) AS count`,
      `FROM ${tableRef}`,
      `WHERE $__timeFilter(${timeColumn})`,
      `GROUP BY time, ${levelColumn}`,
      `ORDER BY time ASC`,
    ].join('\n');

    return {
      ...originalQuery,
      refId: `log-volume-${originalQuery.refId}`,
      rawSql,
      editorType: EditorType.SQL,
      format: queryTypeToFormat(QueryType.TimeSeries),
      queryType: QueryType.TimeSeries,
    } as DatabendQuery;
  }

  getSupplementaryRequest(
    type: SupplementaryQueryType,
    request: DataQueryRequest<DatabendQuery>
  ): DataQueryRequest<DatabendQuery> | undefined {
    if (type !== SupplementaryQueryType.LogsVolume) {
      return undefined;
    }

    const logsTargets = request.targets.filter(
      (t) => !t.hide && t.queryType === QueryType.Logs
    );
    if (logsTargets.length === 0) {
      return undefined;
    }

    const supplementaryTargets = logsTargets
      .map((t) => this.getSupplementaryQuery({ type }, t))
      .filter((q): q is DatabendQuery => q !== undefined);

    if (supplementaryTargets.length === 0) {
      return undefined;
    }

    return {
      ...request,
      targets: supplementaryTargets,
    };
  }

  getDataProvider(
    type: SupplementaryQueryType,
    request: DataQueryRequest<DatabendQuery>
  ): Observable<DataQueryResponse> | undefined {
    const supplementaryRequest = this.getSupplementaryRequest(type, request);
    if (!supplementaryRequest) {
      return undefined;
    }
    return this.query(supplementaryRequest);
  }

  // --- Logs Context Support ---

  async getLogRowContext(
    row: LogRowModel,
    options?: LogRowContextOptions,
    query?: DatabendQuery
  ): Promise<DataQueryResponse> {
    if (!query) {
      throw new Error('Missing query for log context');
    }
    if (!options || !options.direction || options.limit === undefined) {
      throw new Error('Missing log context options for query');
    }
    const timeColumn = this.settings.jsonData.logsTimeColumn || 'timestamp';
    const logsTable = this.settings.jsonData.logsTable || 'otel_logs';
    const db = this.settings.jsonData.defaultDatabase || 'default';

    const direction = options.direction;
    const limit = options.limit;
    const timeOperator =
      direction === LogRowContextQueryDirection.Forward ? '>=' : '<=';
    const orderDir =
      direction === LogRowContextQueryDirection.Forward ? 'ASC' : 'DESC';

    // Use the row's timestamp (nanoseconds epoch) to filter context
    const timeNs = row.timeEpochNs;
    const timeSec = Number(BigInt(timeNs) / BigInt(1000000000));

    const rawSql = `SELECT * FROM ${db}.${logsTable} WHERE ${timeColumn} ${timeOperator} to_timestamp(${timeSec}) ORDER BY ${timeColumn} ${orderDir} LIMIT ${limit}`;

    const contextQuery: DatabendQuery = {
      ...query,
      refId: `log-context-${query.refId}`,
      rawSql,
    };

    const req: DataQueryRequest<DatabendQuery> = {
      targets: [contextQuery],
      range: (getTemplateSrv() as unknown as { timeRange?: TimeRange }).timeRange as TimeRange,
    } as DataQueryRequest<DatabendQuery>;

    return firstValueFrom(super.query(req));
  }

  showContextToggle(row?: LogRowModel): boolean {
    return true;
  }

  // --- Query Modification Support (modifyQuery) ---

  modifyQuery(query: DatabendQuery, action: QueryFixAction): DatabendQuery {
    if (!action.options || !action.options.value) {
      return query;
    }

    const key = action.options.key || '';
    const value = action.options.value;

    if (!key) {
      return query;
    }

    let rawSql = query.rawSql || '';
    if (action.type === 'ADD_FILTER') {
      const filterClause = `${key} = '${value}'`;
      rawSql = addFilterToSql(rawSql, filterClause);
    } else if (action.type === 'ADD_FILTER_OUT') {
      const filterClause = `${key} != '${value}'`;
      rawSql = addFilterToSql(rawSql, filterClause);
    } else if (action.type === 'ADD_STRING_FILTER') {
      const filterClause = `${key} LIKE '%${value}%'`;
      rawSql = addFilterToSql(rawSql, filterClause);
    } else if (action.type === 'ADD_STRING_FILTER_OUT') {
      const filterClause = `${key} NOT LIKE '%${value}%'`;
      rawSql = addFilterToSql(rawSql, filterClause);
    }

    return {
      ...query,
      rawSql,
    };
  }

  getSupportedQueryModifications(): string[] {
    return ['ADD_FILTER', 'ADD_FILTER_OUT', 'ADD_STRING_FILTER', 'ADD_STRING_FILTER_OUT'];
  }

  // --- Ad-Hoc Filters Support ---

  async getTagKeys(): Promise<MetricFindValue[]> {
    const table = this.settings.jsonData.defaultAdHocTable;
    const db = this.settings.jsonData.defaultDatabase || 'default';
    if (!table) {
      return [];
    }
    try {
      const columns = await this.fetchColumns(db, table);
      return columns.map((c) => ({ text: c.name }));
    } catch (err) {
      console.warn('[databend] failed to fetch tag keys', err);
      return [];
    }
  }

  async getTagValues({ key }: any): Promise<MetricFindValue[]> {
    const table = this.settings.jsonData.defaultAdHocTable;
    const db = this.settings.jsonData.defaultDatabase || 'default';
    if (!table || !key) {
      return [];
    }

    // Basic identifier sanity check - bail out if the key contains dangerous chars.
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      console.warn(`[databend] refused to interpolate suspicious tag key: ${key}`);
      return [];
    }

    try {
      const result = await this.metricFindQuery(
        `SELECT DISTINCT ${key} FROM ${db}.${table} WHERE ${key} IS NOT NULL LIMIT ${DEFAULT_AD_HOC_TAG_LIMIT}`
      );
      return result;
    } catch (err) {
      console.warn(`[databend] failed to fetch tag values for ${key}`, err);
      return [];
    }
  }

  // --- Metric Find / Helper Methods ---

  async metricFindQuery(sql: string, options?: any): Promise<MetricFindValue[]> {
    if (!sql) {
      return [];
    }

    const interpolated = getTemplateSrv().replace(sql, options?.scopedVars);
    const request = {
      targets: [
        {
          refId: 'metricFindQuery',
          rawSql: interpolated,
          editorType: EditorType.SQL,
          format: 1,
        },
      ],
      range: options?.range,
      maxDataPoints: 0,
    } as DataQueryRequest<DatabendQuery>;

    const response = await this.querySync(request);
    return this.mapMetricFindResponse(response);
  }

  private async querySync(request: DataQueryRequest<DatabendQuery>): Promise<DataQueryResponse> {
    return firstValueFrom(super.query(request));
  }

  private mapMetricFindResponse(response: DataQueryResponse): MetricFindValue[] {
    const values: MetricFindValue[] = [];
    const data = response.data as DataFrame[];
    if (!data || data.length === 0) {
      return values;
    }

    for (const frame of data) {
      const view = new DataFrameView(frame);
      for (let i = 0; i < view.length; i++) {
        const row = view.get(i);
        const keys = Object.keys(row);
        if (keys.length === 0) {
          continue;
        }
        if (keys.length === 2) {
          values.push({ text: String(row[keys[1]]), value: String(row[keys[0]]) });
        } else {
          values.push({ text: String(row[keys[0]]) });
        }
      }
    }
    return values;
  }

  async fetchDatabases(): Promise<string[]> {
    const result = await this.metricFindQuery('SHOW DATABASES');
    return result.map(r => r.text);
  }

  async fetchTables(database?: string): Promise<string[]> {
    const db = database || this.settings.jsonData.defaultDatabase || 'default';
    const result = await this.metricFindQuery(`SHOW TABLES FROM ${db}`);
    return result.map(r => r.text);
  }

  async fetchColumns(database: string, table: string): Promise<Array<{ name: string; type: string }>> {
    const result = await this.metricFindQuery(`DESCRIBE ${database}.${table}`);
    return result.map(r => ({ name: r.text, type: String(r.value || 'String') }));
  }
}

// Helper to add a filter clause to an existing SQL query
function addFilterToSql(sql: string, filterClause: string): string {
  const whereIndex = sql.toLowerCase().lastIndexOf('where');
  if (whereIndex === -1) {
    // No WHERE clause, try to insert before ORDER BY / GROUP BY / LIMIT
    const insertBefore = sql.match(/\b(ORDER BY|GROUP BY|LIMIT)\b/i);
    if (insertBefore && insertBefore.index !== undefined) {
      return sql.slice(0, insertBefore.index) + 'WHERE ' + filterClause + ' ' + sql.slice(insertBefore.index);
    }
    return sql + ' WHERE ' + filterClause;
  }
  // Insert after existing WHERE
  const afterWhere = whereIndex + 5;
  return sql.slice(0, afterWhere) + ' ' + filterClause + ' AND' + sql.slice(afterWhere);
}

/**
 * Apply Grafana ad-hoc filters to an already interpolated SQL string.
 * Each filter has the shape { key, operator, value }.
 */
function applyAdHocFilters(sql: string, filters: any[]): string {
  if (!filters || filters.length === 0) {
    return sql;
  }
  let out = sql;
  for (const f of filters) {
    if (!f || !f.key) {
      continue;
    }
    // Only allow safe identifiers for ad-hoc keys
    if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(f.key)) {
      continue;
    }
    const clause = buildAdHocClause(f);
    if (clause) {
      out = addFilterToSql(out, clause);
    }
  }
  return out;
}

function buildAdHocClause(f: any): string {
  const op = String(f.operator || '=').toUpperCase();
  const value = f.value;
  const key = f.key;
  switch (op) {
    case '=':
    case '!=':
    case '<':
    case '<=':
    case '>':
    case '>=':
      if (typeof value === 'number') {
        return `${key} ${op} ${value}`;
      }
      return `${key} ${op} '${escapeSqlString(String(value ?? ''))}'`;
    case '=~':
      return `${key} LIKE '%${escapeSqlString(String(value ?? ''))}%'`;
    case '!~':
      return `${key} NOT LIKE '%${escapeSqlString(String(value ?? ''))}%'`;
    default:
      return `${key} ${op} '${escapeSqlString(String(value ?? ''))}'`;
  }
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Normalize annotation queries from the legacy shape (bare `query` string) into
 * the current shape Grafana expects (`target: { rawSql }`).
 * Returns an AnnotationQuery compatible object.
 */
function prepareAnnotation(anno: any): any {
  const next = { ...anno };
  next.target = next.target || {};
  if (typeof next.target.rawSql !== 'string') {
    next.target.rawSql = typeof next.query === 'string' ? next.query : '';
  }
  if (!next.target.refId) {
    next.target.refId = next.name || 'Anno';
  }
  if (!next.target.editorType) {
    next.target.editorType = EditorType.SQL;
  }
  delete next.query;
  return next;
}