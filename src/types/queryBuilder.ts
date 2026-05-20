export enum BuilderMode {
  List = 'list',
  Aggregate = 'aggregate',
  Trend = 'trend',
}

export enum ColumnHint {
  Time = 'time',
  LogLevel = 'log_level',
  LogMessage = 'log_message',
  TraceId = 'trace_id',
  TraceSpanId = 'trace_span_id',
  TraceParentSpanId = 'trace_parent_span_id',
  TraceServiceName = 'trace_service_name',
  TraceOperationName = 'trace_operation_name',
  TraceDurationTime = 'trace_duration_time',
  TraceTags = 'trace_tags',
  TraceServiceTags = 'trace_service_tags',
  TraceStatusCode = 'trace_status_code',
  TraceStatusMessage = 'trace_status_message',
  TraceKind = 'trace_kind',
}

export enum OrderByDirection {
  ASC = 'ASC',
  DESC = 'DESC',
}

export enum AggregateType {
  Count = 'count',
  Sum = 'sum',
  Avg = 'avg',
  Min = 'min',
  Max = 'max',
}

export enum FilterOperator {
  IsAnything = 'IS ANYTHING',
  Equals = '=',
  NotEquals = '!=',
  LessThan = '<',
  LessThanOrEqual = '<=',
  GreaterThan = '>',
  GreaterThanOrEqual = '>=',
  Like = 'LIKE',
  NotLike = 'NOT LIKE',
  In = 'IN',
  NotIn = 'NOT IN',
  IsNull = 'IS NULL',
  IsNotNull = 'IS NOT NULL',
  WithInGrafanaTimeRange = 'WITH IN DASHBOARD TIME RANGE',
}

export interface SelectedColumn {
  name: string;
  hint?: ColumnHint;
  alias?: string;
}

export interface AggregateColumn {
  column: string;
  aggregateType: AggregateType;
  alias?: string;
}

export interface OrderBy {
  name: string;
  dir: OrderByDirection;
}

export interface Filter {
  key: string;
  operator: FilterOperator;
  value?: string | string[] | number | boolean;
  type?: string;
}

export interface TableColumn {
  name: string;
  type: string;
  label?: string;
}

export interface QueryBuilderOptions {
  database: string;
  table: string;
  queryType: string;
  mode: BuilderMode;
  columns: SelectedColumn[];
  aggregates?: AggregateColumn[];
  groupBy?: string[];
  filters?: Filter[];
  orderBy?: OrderBy[];
  limit?: number;
  meta?: Record<string, any>;
}
