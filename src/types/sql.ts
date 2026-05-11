import { DataQuery } from '@grafana/schema';
import { QueryBuilderOptions } from './queryBuilder';

export enum EditorType {
  SQL = 'sql',
  Builder = 'builder',
}

export enum QueryType {
  Table = 'table',
  Logs = 'logs',
  TimeSeries = 'timeseries',
  Traces = 'traces',
}

export interface DatabendQueryBase extends DataQuery {
  pluginVersion?: string;
  editorType: EditorType;
  rawSql: string;
  format?: number;
  queryType?: QueryType;
}

export interface DatabendSqlQuery extends DatabendQueryBase {
  editorType: EditorType.SQL;
  meta?: {
    timezone?: string;
    builderOptions?: QueryBuilderOptions;
  };
  expand?: boolean;
}

export interface DatabendBuilderQuery extends DatabendQueryBase {
  editorType: EditorType.Builder;
  builderOptions: QueryBuilderOptions;
  meta?: {
    timezone?: string;
  };
}

export type DatabendQuery = DatabendSqlQuery | DatabendBuilderQuery;

// Maps QueryType to sqlds format option values (iota in Go):
// 0 = TimeSeries, 1 = Table, 2 = Logs, 3 = Trace, 4 = Multi
export function queryTypeToFormat(queryType: QueryType): number {
  switch (queryType) {
    case QueryType.TimeSeries:
      return 0;
    case QueryType.Table:
      return 1;
    case QueryType.Logs:
      return 2;
    case QueryType.Traces:
      return 3;
    default:
      return 1;
  }
}

export const defaultEditorType: EditorType = EditorType.SQL;
export const defaultDatabendQuery: Omit<DatabendSqlQuery, 'refId'> = {
  pluginVersion: '',
  editorType: EditorType.SQL,
  rawSql: '',
  format: queryTypeToFormat(QueryType.Table),
  expand: false,
};
