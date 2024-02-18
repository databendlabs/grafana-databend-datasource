import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

export interface DatabendQuery extends DataQuery {
  rawSql: string;
  expand?: boolean;
}

export interface DatabendOptions extends DataSourceJsonData {
  dsn: string;
}

export interface DatabendSecureOptions {
  password: string;
}
