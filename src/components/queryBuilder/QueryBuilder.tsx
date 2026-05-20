import React, { useEffect, useState } from 'react';
import { SelectableValue } from '@grafana/data';
import { Select, MultiSelect, InlineField, InlineFieldRow, Input, Button, CodeEditor } from '@grafana/ui';
import { DatabendDatasource } from '../../data/datasource';
import { QueryType } from '../../types/sql';
import {
  QueryBuilderOptions,
  BuilderMode,
  SelectedColumn,
  Filter,
  FilterOperator,
  OrderBy,
  OrderByDirection,
  AggregateColumn,
  AggregateType,
  ColumnHint,
} from '../../types/queryBuilder';

interface QueryBuilderProps {
  datasource: DatabendDatasource;
  builderOptions: QueryBuilderOptions;
  onBuilderOptionsChange: (options: QueryBuilderOptions) => void;
  generatedSql: string;
  queryType?: QueryType;
  onRunQuery: () => void;
}

export const QueryBuilder: React.FC<QueryBuilderProps> = ({
  datasource,
  builderOptions,
  onBuilderOptionsChange,
  generatedSql,
  queryType,
  onRunQuery,
}) => {
  const [databases, setDatabases] = useState<string[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  const [columns, setColumns] = useState<Array<{ name: string; type: string }>>([]);

  useEffect(() => {
    datasource.fetchDatabases().then(setDatabases).catch(() => setDatabases([]));
  }, [datasource]);

  useEffect(() => {
    if (builderOptions.database) {
      datasource.fetchTables(builderOptions.database).then(setTables).catch(() => setTables([]));
    }
  }, [datasource, builderOptions.database]);

  useEffect(() => {
    if (builderOptions.database && builderOptions.table) {
      datasource.fetchColumns(builderOptions.database, builderOptions.table).then(setColumns).catch(() => setColumns([]));
    }
  }, [datasource, builderOptions.database, builderOptions.table]);

  const databaseOptions: Array<SelectableValue<string>> = databases.map(d => ({ label: d, value: d }));
  const tableOptions: Array<SelectableValue<string>> = tables.map(t => ({ label: t, value: t }));
  const columnOptions: Array<SelectableValue<string>> = columns.map(c => ({ label: `${c.name} (${c.type})`, value: c.name }));

  const modeOptions: Array<SelectableValue<BuilderMode>> = [
    { label: 'List', value: BuilderMode.List },
    { label: 'Aggregate', value: BuilderMode.Aggregate },
    { label: 'Trend', value: BuilderMode.Trend },
  ];

  const onDatabaseChange = (value: SelectableValue<string>) => {
    onBuilderOptionsChange({ ...builderOptions, database: value.value || '', table: '', columns: [] });
  };

  const onTableChange = (value: SelectableValue<string>) => {
    onBuilderOptionsChange({ ...builderOptions, table: value.value || '', columns: [] });
  };

  const onModeChange = (value: SelectableValue<BuilderMode>) => {
    onBuilderOptionsChange({ ...builderOptions, mode: value.value || BuilderMode.List });
  };

  const onColumnsChange = (values: Array<SelectableValue<string>>) => {
    const existingHints = new Map(builderOptions.columns.map((c) => [c.name, c.hint] as const));
    const selected: SelectedColumn[] = values.map((v) => {
      const name = v.value || '';
      const hint = existingHints.get(name);
      return hint ? { name, hint } : { name };
    });
    onBuilderOptionsChange({ ...builderOptions, columns: selected });
  };

  const onColumnHintChange = (columnName: string, hint?: ColumnHint) => {
    const nextColumns = builderOptions.columns.map((c) => {
      if (c.name !== columnName) {
        return c;
      }
      if (!hint) {
        const { hint: _discarded, ...rest } = c;
        return rest;
      }
      return { ...c, hint };
    });
    onBuilderOptionsChange({ ...builderOptions, columns: nextColumns });
  };

  const onGroupByChange = (values: Array<SelectableValue<string>>) => {
    onBuilderOptionsChange({ ...builderOptions, groupBy: values.map(v => v.value || '') });
  };

  const onLimitChange = (e: React.FormEvent<HTMLInputElement>) => {
    const val = parseInt(e.currentTarget.value, 10);
    onBuilderOptionsChange({ ...builderOptions, limit: isNaN(val) ? undefined : val });
  };

  const onAddFilter = () => {
    const newFilter: Filter = { key: '', operator: FilterOperator.Equals, value: '' };
    const filters = [...(builderOptions.filters || []), newFilter];
    onBuilderOptionsChange({ ...builderOptions, filters });
  };

  const onFilterChange = (index: number, filter: Filter) => {
    const filters = [...(builderOptions.filters || [])];
    filters[index] = filter;
    onBuilderOptionsChange({ ...builderOptions, filters });
  };

  const onRemoveFilter = (index: number) => {
    const filters = [...(builderOptions.filters || [])];
    filters.splice(index, 1);
    onBuilderOptionsChange({ ...builderOptions, filters });
  };

  const onAddTimeRangeFilter = () => {
    const timeColumn = builderOptions.columns.find((c) => c.hint === ColumnHint.Time)?.name || '';
    const newFilter: Filter = {
      key: timeColumn,
      operator: FilterOperator.WithInGrafanaTimeRange,
      value: '',
    };
    const filters = [...(builderOptions.filters || []), newFilter];
    onBuilderOptionsChange({ ...builderOptions, filters });
  };

  const onAddAggregate = () => {
    const newAgg: AggregateColumn = { column: '*', aggregateType: AggregateType.Count };
    const aggregates = [...(builderOptions.aggregates || []), newAgg];
    onBuilderOptionsChange({ ...builderOptions, aggregates });
  };

  const onAggregateChange = (index: number, agg: AggregateColumn) => {
    const aggregates = [...(builderOptions.aggregates || [])];
    aggregates[index] = agg;
    onBuilderOptionsChange({ ...builderOptions, aggregates });
  };

  const onRemoveAggregate = (index: number) => {
    const aggregates = [...(builderOptions.aggregates || [])];
    aggregates.splice(index, 1);
    onBuilderOptionsChange({ ...builderOptions, aggregates });
  };

  const onAddOrderBy = () => {
    const newOrder: OrderBy = { name: '', dir: OrderByDirection.ASC };
    const orderBy = [...(builderOptions.orderBy || []), newOrder];
    onBuilderOptionsChange({ ...builderOptions, orderBy });
  };

  const onOrderByChange = (index: number, order: OrderBy) => {
    const orderBy = [...(builderOptions.orderBy || [])];
    orderBy[index] = order;
    onBuilderOptionsChange({ ...builderOptions, orderBy });
  };

  const onRemoveOrderBy = (index: number) => {
    const orderBy = [...(builderOptions.orderBy || [])];
    orderBy.splice(index, 1);
    onBuilderOptionsChange({ ...builderOptions, orderBy });
  };

  const aggregateTypeOptions: Array<SelectableValue<AggregateType>> = [
    { label: 'Count', value: AggregateType.Count },
    { label: 'Sum', value: AggregateType.Sum },
    { label: 'Avg', value: AggregateType.Avg },
    { label: 'Min', value: AggregateType.Min },
    { label: 'Max', value: AggregateType.Max },
  ];

  const orderDirOptions: Array<SelectableValue<OrderByDirection>> = [
    { label: 'ASC', value: OrderByDirection.ASC },
    { label: 'DESC', value: OrderByDirection.DESC },
  ];

  const filterOperatorOptions: Array<SelectableValue<FilterOperator>> = [
    { label: 'Within dashboard time range', value: FilterOperator.WithInGrafanaTimeRange },
    { label: '=', value: FilterOperator.Equals },
    { label: '!=', value: FilterOperator.NotEquals },
    { label: '<', value: FilterOperator.LessThan },
    { label: '<=', value: FilterOperator.LessThanOrEqual },
    { label: '>', value: FilterOperator.GreaterThan },
    { label: '>=', value: FilterOperator.GreaterThanOrEqual },
    { label: 'LIKE', value: FilterOperator.Like },
    { label: 'NOT LIKE', value: FilterOperator.NotLike },
    { label: 'IS NULL', value: FilterOperator.IsNull },
    { label: 'IS NOT NULL', value: FilterOperator.IsNotNull },
    { label: 'IN', value: FilterOperator.In },
    { label: 'NOT IN', value: FilterOperator.NotIn },
  ];

  const hintOptionsForQueryType = (qt?: QueryType): Array<SelectableValue<ColumnHint>> => {
    if (qt === QueryType.Logs) {
      return [
        { label: 'Time', value: ColumnHint.Time },
        { label: 'Log Level', value: ColumnHint.LogLevel },
        { label: 'Log Message', value: ColumnHint.LogMessage },
        { label: 'Trace ID', value: ColumnHint.TraceId },
      ];
    }
    if (qt === QueryType.Traces) {
      return [
        { label: 'Start Time', value: ColumnHint.Time },
        { label: 'Trace ID', value: ColumnHint.TraceId },
        { label: 'Span ID', value: ColumnHint.TraceSpanId },
        { label: 'Parent Span ID', value: ColumnHint.TraceParentSpanId },
        { label: 'Service Name', value: ColumnHint.TraceServiceName },
        { label: 'Operation Name', value: ColumnHint.TraceOperationName },
        { label: 'Duration', value: ColumnHint.TraceDurationTime },
      ];
    }
    return [{ label: 'Time', value: ColumnHint.Time }];
  };

  return (
    <div data-testid="query-builder">
      {/* Database & Table Selection */}
      <InlineFieldRow>
        <InlineField label="Database" labelWidth={14}>
          <Select
            width={25}
            options={databaseOptions}
            value={builderOptions.database}
            onChange={onDatabaseChange}
            allowCustomValue
            placeholder="Select database"
            aria-label="Database"
          />
        </InlineField>
        <InlineField label="Table" labelWidth={10}>
          <Select
            width={25}
            options={tableOptions}
            value={builderOptions.table}
            onChange={onTableChange}
            allowCustomValue
            placeholder="Select table"
            aria-label="Table"
          />
        </InlineField>
        <InlineField label="Mode" labelWidth={10}>
          <Select
            width={20}
            options={modeOptions}
            value={builderOptions.mode}
            onChange={onModeChange}
            aria-label="Builder Mode"
          />
        </InlineField>
      </InlineFieldRow>

      {/* Columns (List mode) */}
      {builderOptions.mode === BuilderMode.List && (
        <InlineFieldRow>
          <InlineField label="Columns" labelWidth={14} grow>
            <MultiSelect
              options={columnOptions}
              value={builderOptions.columns.map(c => ({ label: c.name, value: c.name }))}
              onChange={onColumnsChange}
              allowCustomValue
              placeholder="Select columns (empty = *)"
              aria-label="Columns"
            />
          </InlineField>
        </InlineFieldRow>
      )}

      {/* Column hints (Logs / Traces only) */}
      {builderOptions.mode === BuilderMode.List &&
        (queryType === QueryType.Logs || queryType === QueryType.Traces) &&
        builderOptions.columns.length > 0 && (
          <>
            {builderOptions.columns.map((col, i) => (
              <InlineFieldRow key={`hint-${col.name}-${i}`}>
                <InlineField label={i === 0 ? 'Hints' : ''} labelWidth={14}>
                  <Input width={25} value={col.name} readOnly aria-label="Hint Column" />
                </InlineField>
                <InlineField label="Role" labelWidth={8}>
                  <Select
                    width={25}
                    options={hintOptionsForQueryType(queryType)}
                    value={col.hint}
                    onChange={(v) => onColumnHintChange(col.name, v.value ?? undefined)}
                    isClearable
                    placeholder="no hint"
                    aria-label="Column Hint"
                  />
                </InlineField>
              </InlineFieldRow>
            ))}
          </>
        )}

      {/* Aggregates (Aggregate/Trend mode) */}
      {(builderOptions.mode === BuilderMode.Aggregate || builderOptions.mode === BuilderMode.Trend) && (
        <>
          <InlineFieldRow>
            <InlineField label="Group By" labelWidth={14} grow>
              <MultiSelect
                options={columnOptions}
                value={(builderOptions.groupBy || []).map(g => ({ label: g, value: g }))}
                onChange={onGroupByChange}
                allowCustomValue
                placeholder="Select group by columns"
                aria-label="Group By"
              />
            </InlineField>
          </InlineFieldRow>
          {(builderOptions.aggregates || []).map((agg, i) => (
            <InlineFieldRow key={i}>
              <InlineField label={i === 0 ? 'Aggregates' : ''} labelWidth={14}>
                <Select
                  width={15}
                  options={aggregateTypeOptions}
                  value={agg.aggregateType}
                  onChange={(v) => onAggregateChange(i, { ...agg, aggregateType: v.value || AggregateType.Count })}
                  aria-label="Aggregate Type"
                />
              </InlineField>
              <InlineField label="">
                <Select
                  width={20}
                  options={columnOptions}
                  value={agg.column}
                  onChange={(v) => onAggregateChange(i, { ...agg, column: v.value || '*' })}
                  allowCustomValue
                  placeholder="column"
                  aria-label="Aggregate Column"
                />
              </InlineField>
              <InlineField label="">
                <Input
                  width={15}
                  value={agg.alias || ''}
                  onChange={(e) => onAggregateChange(i, { ...agg, alias: e.currentTarget.value })}
                  placeholder="alias"
                  aria-label="Aggregate Alias"
                />
              </InlineField>
              <Button variant="secondary" size="sm" icon="times" onClick={() => onRemoveAggregate(i)} aria-label="Remove aggregate" />
            </InlineFieldRow>
          ))}
          <Button variant="secondary" size="sm" icon="plus" onClick={onAddAggregate}>
            Add Aggregate
          </Button>
        </>
      )}

      {/* Filters */}
      {(builderOptions.filters || []).map((filter, i) => (
        <InlineFieldRow key={i}>
          <InlineField label={i === 0 ? 'Filters' : ''} labelWidth={14}>
            <Select
              width={20}
              options={columnOptions}
              value={filter.key}
              onChange={(v) => onFilterChange(i, { ...filter, key: v.value || '' })}
              allowCustomValue
              placeholder="column"
              aria-label="Filter Column"
            />
          </InlineField>
          <InlineField label="">
            <Select
              width={15}
              options={filterOperatorOptions}
              value={filter.operator}
              onChange={(v) => onFilterChange(i, { ...filter, operator: v.value || FilterOperator.Equals })}
              aria-label="Filter Operator"
            />
          </InlineField>
          {filter.operator !== FilterOperator.IsNull &&
            filter.operator !== FilterOperator.IsNotNull &&
            filter.operator !== FilterOperator.WithInGrafanaTimeRange && (
            <InlineField label="">
              <Input
                width={20}
                value={String(filter.value || '')}
                onChange={(e) => onFilterChange(i, { ...filter, value: e.currentTarget.value })}
                placeholder="value"
                aria-label="Filter Value"
              />
            </InlineField>
          )}
          <Button variant="secondary" size="sm" icon="times" onClick={() => onRemoveFilter(i)} aria-label="Remove filter" />
        </InlineFieldRow>
      ))}
      <InlineFieldRow>
        <InlineField label={builderOptions.filters?.length ? '' : 'Filters'} labelWidth={14}>
          <Button variant="secondary" size="sm" icon="plus" onClick={onAddFilter}>
            Add Filter
          </Button>
        </InlineField>
        <Button variant="secondary" size="sm" icon="clock-nine" onClick={onAddTimeRangeFilter}>
          Add dashboard time range
        </Button>
      </InlineFieldRow>

      {/* Order By */}
      {(builderOptions.orderBy || []).map((order, i) => (
        <InlineFieldRow key={i}>
          <InlineField label={i === 0 ? 'Order By' : ''} labelWidth={14}>
            <Select
              width={20}
              options={columnOptions}
              value={order.name}
              onChange={(v) => onOrderByChange(i, { ...order, name: v.value || '' })}
              allowCustomValue
              placeholder="column"
              aria-label="Order By Column"
            />
          </InlineField>
          <InlineField label="">
            <Select
              width={12}
              options={orderDirOptions}
              value={order.dir}
              onChange={(v) => onOrderByChange(i, { ...order, dir: v.value || OrderByDirection.ASC })}
              aria-label="Order Direction"
            />
          </InlineField>
          <Button variant="secondary" size="sm" icon="times" onClick={() => onRemoveOrderBy(i)} aria-label="Remove order by" />
        </InlineFieldRow>
      ))}
      <InlineFieldRow>
        <InlineField label={builderOptions.orderBy?.length ? '' : 'Order By'} labelWidth={14}>
          <Button variant="secondary" size="sm" icon="plus" onClick={onAddOrderBy}>
            Add Order By
          </Button>
        </InlineField>
      </InlineFieldRow>

      {/* Limit */}
      <InlineFieldRow>
        <InlineField label="Limit" labelWidth={14}>
          <Input
            width={10}
            type="number"
            value={builderOptions.limit || ''}
            onChange={onLimitChange}
            placeholder="1000"
            aria-label="Limit"
          />
        </InlineField>
        <Button variant="primary" size="sm" icon="play" onClick={onRunQuery}>
          Run query
        </Button>
      </InlineFieldRow>

      {/* SQL Preview */}
      <InlineFieldRow>
        <InlineField label="SQL Preview" labelWidth={14} grow>
          <CodeEditor
            aria-label="SQL Preview"
            height="100px"
            language="sql"
            value={generatedSql}
            readOnly={true}
            showMiniMap={false}
            showLineNumbers={false}
          />
        </InlineField>
      </InlineFieldRow>
    </div>
  );
};
