import React, { useMemo } from 'react';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, RadioButtonGroup, Select } from '@grafana/ui';
import { DatabendDatasource } from '../data/datasource';
import { DatabendConfig } from '../types/config';
import { DatabendQuery, EditorType, QueryType, defaultDatabendQuery, queryTypeToFormat } from '../types/sql';
import { BuilderMode, QueryBuilderOptions } from '../types/queryBuilder';
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
  const queryType = (currentQuery as any).queryType || QueryType.Table;

  const builderOptions: QueryBuilderOptions = useMemo(() => {
    if (currentQuery.editorType === EditorType.Builder) {
      return (currentQuery as any).builderOptions || defaultBuilderOptions;
    }
    return (currentQuery as any).meta?.builderOptions || defaultBuilderOptions;
  }, [currentQuery]);

  const generatedSql = useMemo(() => generateSql(builderOptions), [builderOptions]);

  const onEditorTypeChange = (newType: EditorType) => {
    if (newType === EditorType.Builder) {
      onChange({
        ...currentQuery,
        editorType: EditorType.Builder,
        builderOptions,
        rawSql: generatedSql,
      } as DatabendQuery);
    } else {
      onChange({
        ...currentQuery,
        editorType: EditorType.SQL,
        meta: { ...(currentQuery as any).meta, builderOptions },
      } as DatabendQuery);
    }
    onRunQuery();
  };

  const onQueryTypeChange = (value: SelectableValue<QueryType>) => {
    const newQueryType = value.value || QueryType.Table;
    onChange({
      ...currentQuery,
      queryType: newQueryType,
      format: queryTypeToFormat(newQueryType),
    } as DatabendQuery);
    onRunQuery();
  };

  const onQueryChange = (updatedQuery: DatabendQuery) => {
    onChange(updatedQuery);
    onRunQuery();
  };

  const onBuilderOptionsChange = (newOptions: QueryBuilderOptions) => {
    const newSql = generateSql(newOptions);
    const builderQueryType = newOptions.queryType as unknown as QueryType || QueryType.Table;
    onChange({
      ...currentQuery,
      editorType: EditorType.Builder,
      builderOptions: newOptions,
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
        />
      )}
    </>
  );
};
