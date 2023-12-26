import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

export interface DatabendQuery extends DataQuery {
  sql: string;
  timeColumns?: string[];
}

export interface DatabendOptions extends DataSourceJsonData {
  dsn: string;
}

export interface DatabendSecureOptions {
  password: string;
}
