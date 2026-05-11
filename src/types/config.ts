import { DataSourceJsonData } from '@grafana/data';

export interface DatabendConfig extends DataSourceJsonData {
  dsn: string;
  defaultDatabase?: string;
  dialTimeout?: string;
  queryTimeout?: string;
  forwardGrafanaHeaders?: boolean;

  // Logs
  logsTable?: string;
  logsTimeColumn?: string;
  logsLevelColumn?: string;
  logsMessageColumn?: string;
  showLogLinks?: boolean;

  // Traces
  tracesTable?: string;
  tracesTraceIdColumn?: string;
  tracesSpanIdColumn?: string;
  tracesOperationNameColumn?: string;
  tracesServiceNameColumn?: string;
  tracesDurationColumn?: string;
  tracesDurationUnit?: string;
  tracesStartTimeColumn?: string;
  showTraceLinks?: boolean;

  // Ad-hoc filters
  defaultAdHocTable?: string;
}

export interface DatabendSecureConfig {
  password?: string;
}

export const defaultLogsTable = 'otel_logs';
export const defaultTracesTable = 'otel_traces';
