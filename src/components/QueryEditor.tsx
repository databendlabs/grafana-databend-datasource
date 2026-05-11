import React, { useMemo } from 'react';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, RadioButtonGroup, Select } from '@grafana/ui';
import { DatabendDatasource } from '../data/datasource';
import { DatabendConfig } from '../types/config';
import { DatabendQuery, EditorType, QueryType, defaultDatabendQuery, queryTypeToFormat } from '../types/sql';
import { BuilderMode, ColumnHint, QueryBuilderOptions, SelectedColumn } from '../types/queryBuilder';
import { generateSql } from '../data/sqlGenerator';
import { SqlEditor } from './SqlEditor';
import { QueryBuilder } from './queryBuilder/QueryBuilder';

type Props = QueryEditorProps<DatabendDatasource, DatabendQuery, DatabendConfig>;

const editorTypeOptions = [
  { label: 'SQL', value: EditorType.SQL },
  { label: 'Builder', value: EditorType.Builder },
];

const queryTypeOptions: Array<SelectableValue<QueryType>> = [
  { label: 'Table', value: QueryType.Table },
  { label: 'Time Series', value: QueryType.TimeSeries },
  { label: 'Logs', value: QueryType.Logs },
  { label: 'Traces', value: QueryType.Traces },
];

const defaultBuilderOptions: QueryBuilderOptions = {
  database: '',
  table: '',
  queryType: 'table',
  mode: BuilderMode.List,
  columns: [],
  filters: [],
  orderBy: [],
  limit: 1000,
};

export const QueryEditor: React.FC<Props> = (props) => {
  const { query, onChange, onRunQuery, datasource } = props;

  // Ensure query has defaults
  const currentQuery: DatabendQuery = {
    ...defaultDatabendQuery,
    ...query,
  } as DatabendQuery;

  const editorType = currentQuery.editorType || EditorType.SQL;
  const queryType = currentQuery.queryType || QueryType.Table;

  const builderOptions: QueryBuilderOptions = useMemo(() => {
    if (currentQuery.editorType === EditorType.Builder) {
      return currentQuery.builderOptions || defaultBuilderOptions;
    }
    return currentQuery.meta?.builderOptions || defaultBuilderOptions;
  }, [currentQuery]);

  const generatedSql = useMemo(() => generateSql(builderOptions), [builderOptions]);

  const onEditorTypeChange = (newType: EditorType) => {
    const format = currentQuery.format ?? queryTypeToFormat(queryType);
    if (newType === EditorType.Builder) {
      onChange({
        ...currentQuery,
        editorType: EditorType.Builder,
        builderOptions,
        rawSql: generatedSql,
        format,
      } as DatabendQuery);
    } else {
      onChange({
        ...currentQuery,
        editorType: EditorType.SQL,
        meta: {
          ...(currentQuery.editorType === EditorType.SQL ? currentQuery.meta : undefined),
          builderOptions,
        },
        format,
      } as DatabendQuery);
    }
    onRunQuery();
  };

  const onQueryTypeChange = (value: SelectableValue<QueryType>) => {
    const newQueryType = value.value || QueryType.Table;

    // Re-hydrate builder options when switching query type in Builder mode
    const nextBuilderOptions: QueryBuilderOptions = {
      ...builderOptions,
      queryType: newQueryType,
      columns: applyHintsForQueryType(builderOptions.columns, newQueryType, datasource),
    };

    if (currentQuery.editorType === EditorType.Builder) {
      const newSql = generateSql(nextBuilderOptions);
      onChange({
        ...currentQuery,
        queryType: newQueryType,
        format: queryTypeToFormat(newQueryType),
        builderOptions: nextBuilderOptions,
        rawSql: newSql,
      } as DatabendQuery);
    } else {
      onChange({
        ...currentQuery,
        queryType: newQueryType,
        format: queryTypeToFormat(newQueryType),
        meta: {
          ...(currentQuery.editorType === EditorType.SQL ? currentQuery.meta : undefined),
          builderOptions: nextBuilderOptions,
        },
      } as DatabendQuery);
    }
    onRunQuery();
  };

  const onQueryChange = (updatedQuery: DatabendQuery) => {
    // Ensure format is always set so the backend doesn't default to TimeSeries
    const format = updatedQuery.format ?? queryTypeToFormat(queryType);
    onChange({ ...updatedQuery, format } as DatabendQuery);
    onRunQuery();
  };

  const onBuilderOptionsChange = (newOptions: QueryBuilderOptions) => {
    // Keep builderOptions.queryType aligned with the editor queryType
    const mergedOptions: QueryBuilderOptions = {
      ...newOptions,
      queryType: newOptions.queryType || queryType,
    };
    const newSql = generateSql(mergedOptions);
    const builderQueryType = (mergedOptions.queryType as unknown as QueryType) || QueryType.Table;
    onChange({
      ...currentQuery,
      editorType: EditorType.Builder,
      queryType: builderQueryType,
      builderOptions: mergedOptions,
      rawSql: newSql,
      format: queryTypeToFormat(builderQueryType),
    } as DatabendQuery);
    onRunQuery();
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Editor" labelWidth={10}>
          <RadioButtonGroup
            options={editorTypeOptions}
            value={editorType}
            onChange={onEditorTypeChange}
            size="sm"
          />
        </InlineField>
        <InlineField label="Query Type" labelWidth={12}>
          <Select
            width={20}
            options={queryTypeOptions}
            value={queryType}
            onChange={onQueryTypeChange}
            aria-label="Query Type"
          />
        </InlineField>
      </InlineFieldRow>

      {editorType === EditorType.SQL && (
        <SqlEditor
          query={currentQuery}
          onChange={onQueryChange}
          onRunQuery={onRunQuery}
          queryType={queryType}
          onQueryTypeChange={(qt) => onQueryTypeChange({ value: qt })}
        />
      )}

      {editorType === EditorType.Builder && (
        <QueryBuilder
          datasource={datasource}
          builderOptions={builderOptions}
          onBuilderOptionsChange={onBuilderOptionsChange}
          generatedSql={generatedSql}
          queryType={queryType}
        />
      )}
    </>
  );
};

/**
 * Apply default column hints for the chosen query type based on datasource
 * schema settings (logs/traces columns). Preserves user-picked columns.
 */
function applyHintsForQueryType(
  columns: SelectedColumn[],
  queryType: QueryType,
  datasource: DatabendDatasource
): SelectedColumn[] {
  const jsonData = datasource.settings.jsonData;
  const hintMap = new Map<string, ColumnHint>();

  if (queryType === QueryType.Logs) {
    if (jsonData.logsTimeColumn) hintMap.set(jsonData.logsTimeColumn, ColumnHint.Time);
    if (jsonData.logsLevelColumn) hintMap.set(jsonData.logsLevelColumn, ColumnHint.LogLevel);
    if (jsonData.logsMessageColumn) hintMap.set(jsonData.logsMessageColumn, ColumnHint.LogMessage);
  } else if (queryType === QueryType.Traces) {
    if (jsonData.tracesStartTimeColumn) hintMap.set(jsonData.tracesStartTimeColumn, ColumnHint.Time);
    if (jsonData.tracesTraceIdColumn) hintMap.set(jsonData.tracesTraceIdColumn, ColumnHint.TraceId);
    if (jsonData.tracesSpanIdColumn) hintMap.set(jsonData.tracesSpanIdColumn, ColumnHint.TraceSpanId);
    if (jsonData.tracesOperationNameColumn)
      hintMap.set(jsonData.tracesOperationNameColumn, ColumnHint.TraceOperationName);
    if (jsonData.tracesServiceNameColumn)
      hintMap.set(jsonData.tracesServiceNameColumn, ColumnHint.TraceServiceName);
    if (jsonData.tracesDurationColumn)
      hintMap.set(jsonData.tracesDurationColumn, ColumnHint.TraceDurationTime);
  } else if (queryType === QueryType.TimeSeries) {
    // For time series, only set a time hint if we know a sensible default
    if (jsonData.logsTimeColumn) hintMap.set(jsonData.logsTimeColumn, ColumnHint.Time);
  }

  const existingNames = new Set(columns.map((c) => c.name));
  const nextColumns: SelectedColumn[] = columns.map((c) => {
    const hint = hintMap.get(c.name);
    return hint ? { ...c, hint } : c;
  });

  // For logs/traces, prepend any missing hint columns so the builder has the shape it needs.
  if (queryType === QueryType.Logs || queryType === QueryType.Traces) {
    for (const [name, hint] of hintMap) {
      if (!existingNames.has(name)) {
        nextColumns.push({ name, hint });
      }
    }
  }

  return nextColumns;
}
