import {
  DataFrame,
  DataFrameView,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  DataSourceWithSupplementaryQueriesSupport,
  MetricFindValue,
  ScopedVars,
  SupplementaryQueryType,
} from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime';
import { Observable } from 'rxjs';
import { DatabendConfig } from 'types/config';
import { DatabendQuery, EditorType, QueryType, queryTypeToFormat } from 'types/sql';

export class DatabendDatasource
  extends DataSourceWithBackend<DatabendQuery, DatabendConfig>
  implements DataSourceWithSupplementaryQueriesSupport<DatabendQuery>
{
  annotations = {};
  settings: DataSourceInstanceSettings<DatabendConfig>;

  constructor(instanceSettings: DataSourceInstanceSettings<DatabendConfig>) {
    super(instanceSettings);
    this.settings = instanceSettings;
  }

  applyTemplateVariables(query: DatabendQuery, scopedVars: ScopedVars): DatabendQuery {
    return {
      ...query,
      rawSql: this.replace(query.rawSql, scopedVars) || '',
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
    return super.query(request);
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
    const queryType = (originalQuery as any).queryType;
    if (queryType !== QueryType.Logs) {
      return undefined;
    }

    const logsTable = this.settings.jsonData.logsTable || 'otel_logs';
    const timeColumn = this.settings.jsonData.logsTimeColumn || 'timestamp';
    const levelColumn = this.settings.jsonData.logsLevelColumn || 'level';

    return {
      ...originalQuery,
      refId: `log-volume-${originalQuery.refId}`,
      rawSql: `SELECT $__timeInterval(${timeColumn}) as time, ${levelColumn} as level, count(*) as count FROM ${logsTable} WHERE $__timeFilter(${timeColumn}) GROUP BY time, level ORDER BY time ASC`,
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
      (t) => !t.hide && (t as any).queryType === QueryType.Logs
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
    return new Promise((resolve, reject) => {
      super.query(request).subscribe({
        next: (response) => resolve(response),
        error: (error) => reject(error),
      });
    });
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
