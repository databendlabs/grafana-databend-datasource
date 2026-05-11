import { CoreApp, DataFrame, DataQueryRequest, DataQueryResponse, FieldConfig } from '@grafana/data';
import { DatabendDatasource } from './datasource';
import { DatabendQuery, DatabendBuilderQuery, EditorType, QueryType, queryTypeToFormat } from '../types/sql';
import { BuilderMode, ColumnHint, FilterOperator, OrderByDirection } from '../types/queryBuilder';
import { generateSql } from './sqlGenerator';

/**
 * Field config map for trace search result columns.
 * Maps column name (lowercase) to Grafana FieldConfig for better default display.
 */
const traceSearchFieldConfigs: Record<string, FieldConfig> = {
  duration: {
    unit: 'ms',
    displayName: 'Duration',
  },
  starttime: {
    displayName: 'Start Time',
  },
  start_time: {
    displayName: 'Start Time',
  },
  servicename: {
    displayName: 'Service Name',
  },
  service_name: {
    displayName: 'Service Name',
  },
  operationname: {
    displayName: 'Operation Name',
  },
  operation_name: {
    displayName: 'Operation Name',
  },
  traceid: {
    displayName: 'Trace ID',
  },
  trace_id: {
    displayName: 'Trace ID',
  },
};

/**
 * Applies field configs to trace search result frames for better default display.
 */
export const applyTraceSearchFieldConfig = (req: DataQueryRequest<DatabendQuery>, res: DataQueryResponse): void => {
  res.data.forEach((frame: DataFrame) => {
    const originalQuery = req.targets.find((t) => t.refId === frame.refId);
    if (!originalQuery) {
      return;
    }
    const isTraceSearch =
      originalQuery.editorType === EditorType.Builder &&
      (originalQuery as DatabendBuilderQuery).builderOptions?.queryType === 'traces' &&
      !(originalQuery as DatabendBuilderQuery).builderOptions?.meta?.isTraceIdMode;

    if (!isTraceSearch) {
      return;
    }

    frame.fields.forEach((field) => {
      const fieldConfig = traceSearchFieldConfigs[field.name.toLowerCase()];
      if (fieldConfig) {
        field.config = {
          ...field.config,
          ...fieldConfig,
        };
      }
    });
  });
};

/**
 * Mutates the DataQueryResponse to include trace/log links on the traceID field.
 * The link will open a second query editor in split view on the explore page
 * with the selected trace ID.
 */
export const transformQueryResponseWithTraceAndLogLinks = (
  datasource: DatabendDatasource,
  req: DataQueryRequest<DatabendQuery>,
  res: DataQueryResponse
): DataQueryResponse => {
  applyTraceSearchFieldConfig(req, res);

  const settings = datasource.settings.jsonData;
  const showTraceLinks = settings.showTraceLinks !== false;
  const showLogLinks = settings.showLogLinks !== false;

  if (!showTraceLinks && !showLogLinks) {
    return res;
  }

  res.data.forEach((frame: DataFrame) => {
    const originalQuery = req.targets.find((t) => t.refId === frame.refId);
    if (!originalQuery) {
      return;
    }

    const traceField = frame.fields.find(
      (field) => field.name.toLowerCase() === 'traceid' || field.name.toLowerCase() === 'trace_id'
    );

    if (!traceField) {
      return;
    }

    // Build trace ID query
    const traceIdColumn = settings.tracesTraceIdColumn || 'trace_id';
    const tracesTable = settings.tracesTable || 'otel_traces';
    const tracesDb = settings.defaultDatabase || 'default';
    const traceIdQuery: DatabendBuilderQuery = {
      refId: 'Trace ID',
      editorType: EditorType.Builder,
      rawSql: '',
      builderOptions: {
        database: tracesDb,
        table: tracesTable,
        queryType: 'traces',
        mode: BuilderMode.List,
        columns: [
          { name: traceIdColumn, hint: ColumnHint.TraceId },
          { name: settings.tracesSpanIdColumn || 'span_id', hint: ColumnHint.TraceSpanId },
          { name: settings.tracesOperationNameColumn || 'operation_name', hint: ColumnHint.TraceOperationName },
          { name: settings.tracesServiceNameColumn || 'service_name', hint: ColumnHint.TraceServiceName },
          { name: settings.tracesDurationColumn || 'duration', hint: ColumnHint.TraceDurationTime },
          { name: settings.tracesStartTimeColumn || 'timestamp', hint: ColumnHint.Time },
        ],
        filters: [],
        orderBy: [],
        meta: {
          isTraceIdMode: true,
          traceId: '${__value.raw}',
          traceDurationUnit: settings.tracesDurationUnit || 'ms',
        },
      },
    };

    // Generate rawSql for the trace query
    const openInNewWindow = req.app !== CoreApp.Explore;
    traceIdQuery.rawSql = generateSql(traceIdQuery.builderOptions);

    // Build logs query filtered by traceId
    const logsTable = settings.logsTable || 'otel_logs';
    const logsTimeColumn = settings.logsTimeColumn || 'timestamp';
    const logsLevelColumn = settings.logsLevelColumn || 'level';
    const logsMessageColumn = settings.logsMessageColumn || 'body';

    const traceLogsQuery: DatabendBuilderQuery = {
      refId: 'Trace Logs',
      editorType: EditorType.Builder,
      rawSql: '',
      builderOptions: {
        database: tracesDb,
        table: logsTable,
        queryType: 'logs',
        mode: BuilderMode.List,
        columns: [
          { name: logsTimeColumn, hint: ColumnHint.Time },
          { name: logsLevelColumn, hint: ColumnHint.LogLevel },
          { name: logsMessageColumn, hint: ColumnHint.LogMessage },
          { name: traceIdColumn, hint: ColumnHint.TraceId },
        ],
        filters: [
          {
            key: traceIdColumn,
            operator: FilterOperator.Equals,
            value: '${__value.raw}',
          },
        ],
        orderBy: [{ name: logsTimeColumn, dir: OrderByDirection.ASC }],
      },
      format: queryTypeToFormat(QueryType.Logs),
    };
    // Generate rawSql for Dashboard mode to preserve query through serialization
    if (openInNewWindow) {
      traceLogsQuery.rawSql = generateSql(traceLogsQuery.builderOptions);
    } else {
      traceLogsQuery.rawSql = '';
    }

    traceField.config = traceField.config || {};
    traceField.config.links = [];

    if (showTraceLinks) {
      traceField.config.links.push({
        title: 'View trace',
        targetBlank: openInNewWindow,
        url: '',
        internal: {
          query: traceIdQuery,
          datasourceUid: datasource.uid,
          datasourceName: datasource.type,
          panelsState: {
            trace: {
              spanId: '${__value.raw}',
            },
          },
        },
      });
    }

    if (showLogLinks) {
      traceField.config.links.push({
        title: 'View logs',
        targetBlank: openInNewWindow,
        url: '',
        internal: {
          query: traceLogsQuery,
          datasourceUid: datasource.uid,
          datasourceName: datasource.type,
        },
      });
    }
  });

  return res;
};
