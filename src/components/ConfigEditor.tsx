import React from 'react';
import { Divider, Field, Input, SecretInput, Switch } from '@grafana/ui';
import {
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceSecureJsonDataOption,
} from '@grafana/data';
import { ConfigSection, ConfigSubSection } from '@grafana/experimental';
import { DatabendConfig, DatabendSecureConfig, defaultLogsTable, defaultTracesTable } from '../types/config';

export interface Props extends DataSourcePluginOptionsEditorProps<DatabendConfig, DatabendSecureConfig> {}

export const ConfigEditor: React.FC<Props> = (props) => {
  const { options, onOptionsChange } = props;
  const { jsonData, secureJsonFields } = options;
  const secureJsonData = (options.secureJsonData || {}) as DatabendSecureConfig;

  const onResetPassword = () => {
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...options.secureJsonFields,
        password: false,
      },
      secureJsonData: {
        ...options.secureJsonData,
        password: '',
      },
    });
  };

  const onJsonDataChange = <K extends keyof DatabendConfig>(key: K, value: DatabendConfig[K]) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        [key]: value,
      },
    });
  };

  return (
    <>
      <ConfigSection title="Connection">
        <Field
          required
          label="DSN"
          description="Data Source Name (e.g. databend://user:pass@host:8000/database?sslmode=disable)"
          invalid={!jsonData.dsn}
          error={'DSN is required'}
        >
          <Input
            name="dsn"
            width={60}
            value={jsonData.dsn || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'dsn')}
            aria-label="DSN"
            placeholder="databend://root:@localhost:8000/default?sslmode=disable"
          />
        </Field>
        <Field label="Password" description="Password to override in DSN">
          <SecretInput
            name="password"
            width={60}
            aria-label="Password"
            placeholder="password"
            value={secureJsonData.password || ''}
            isConfigured={(secureJsonFields && secureJsonFields.password) as boolean}
            onReset={onResetPassword}
            onChange={onUpdateDatasourceSecureJsonDataOption(props, 'password')}
          />
        </Field>
        <Field label="Default Database" description="Default database to use when none is specified">
          <Input
            name="defaultDatabase"
            width={40}
            value={jsonData.defaultDatabase || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'defaultDatabase')}
            aria-label="Default Database"
            placeholder="default"
          />
        </Field>
        <Field label="Query Timeout" description="Timeout for queries (e.g. 60s, 5m)">
          <Input
            name="queryTimeout"
            width={20}
            value={jsonData.queryTimeout || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'queryTimeout')}
            aria-label="Query Timeout"
            placeholder="60s"
          />
        </Field>
      </ConfigSection>

      <Divider />

      <ConfigSection title="Additional Settings">
        <Field label="Forward Grafana Headers" description="Forward OAuth/session headers to the datasource">
          <Switch
            value={jsonData.forwardGrafanaHeaders || false}
            onChange={(e) => onJsonDataChange('forwardGrafanaHeaders', e.currentTarget.checked)}
          />
        </Field>
        <Field label="Default Ad-Hoc Filter Table" description="Default table for ad-hoc filter tag keys/values">
          <Input
            name="defaultAdHocTable"
            width={40}
            value={jsonData.defaultAdHocTable || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'defaultAdHocTable')}
            aria-label="Default Ad-Hoc Filter Table"
            placeholder="my_table"
          />
        </Field>
      </ConfigSection>

      <Divider />

      <ConfigSection title="Logs" description="Default settings for log queries">
        <ConfigSubSection title="Schema">
          <Field label="Default Log Table">
            <Input
              name="logsTable"
              width={40}
              value={jsonData.logsTable || ''}
              onChange={onUpdateDatasourceJsonDataOption(props, 'logsTable')}
              aria-label="Default Log Table"
              placeholder={defaultLogsTable}
            />
          </Field>
          <Field label="Time Column" description="Column with the log timestamp">
            <Input
              name="logsTimeColumn"
              width={40}
              value={jsonData.logsTimeColumn || ''}
              onChange={onUpdateDatasourceJsonDataOption(props, 'logsTimeColumn')}
              aria-label="Log Time Column"
              placeholder="timestamp"
            />
          </Field>
          <Field label="Level Column" description="Column with the log level">
            <Input
              name="logsLevelColumn"
              width={40}
              value={jsonData.logsLevelColumn || ''}
              onChange={onUpdateDatasourceJsonDataOption(props, 'logsLevelColumn')}
              aria-label="Log Level Column"
              placeholder="level"
            />
          </Field>
          <Field label="Message Column" description="Column with the log message">
            <Input
              name="logsMessageColumn"
              width={40}
              value={jsonData.logsMessageColumn || ''}
              onChange={onUpdateDatasourceJsonDataOption(props, 'logsMessageColumn')}
              aria-label="Log Message Column"
              placeholder="body"
            />
          </Field>
        </ConfigSubSection>
        <ConfigSubSection title="Data Links">
          <Field label="Show Trace Links" description="Show clickable trace links on TraceId fields in log query results">
            <Switch
              value={jsonData.showLogLinks !== false}
              onChange={(e) => onJsonDataChange('showLogLinks', e.currentTarget.checked)}
            />
          </Field>
        </ConfigSubSection>
      </ConfigSection>

      <Divider />

      <ConfigSection title="Traces" description="Default settings for trace queries">
        <ConfigSubSection title="Schema">
          <Field label="Default Traces Table">
            <Input
              name="tracesTable"
              width={40}
              value={jsonData.tracesTable || ''}
              onChange={onUpdateDatasourceJsonDataOption(props, 'tracesTable')}
              aria-label="Default Traces Table"
              placeholder={defaultTracesTable}
            />
          </Field>
          <Field label="Trace ID Column">
            <Input
              name="tracesTraceIdColumn"
              width={40}
              value={jsonData.tracesTraceIdColumn || ''}
              onChange={onUpdateDatasourceJsonDataOption(props, 'tracesTraceIdColumn')}
              aria-label="Trace ID Column"
              placeholder="trace_id"
            />
          </Field>
          <Field label="Span ID Column">
            <Input
              name="tracesSpanIdColumn"
              width={40}
              value={jsonData.tracesSpanIdColumn || ''}
              onChange={onUpdateDatasourceJsonDataOption(props, 'tracesSpanIdColumn')}
              aria-label="Span ID Column"
              placeholder="span_id"
            />
          </Field>
          <Field label="Operation Name Column">
            <Input
              name="tracesOperationNameColumn"
              width={40}
              value={jsonData.tracesOperationNameColumn || ''}
              onChange={onUpdateDatasourceJsonDataOption(props, 'tracesOperationNameColumn')}
              aria-label="Operation Name Column"
              placeholder="operation_name"
            />
          </Field>
          <Field label="Service Name Column">
            <Input
              name="tracesServiceNameColumn"
              width={40}
              value={jsonData.tracesServiceNameColumn || ''}
              onChange={onUpdateDatasourceJsonDataOption(props, 'tracesServiceNameColumn')}
              aria-label="Service Name Column"
              placeholder="service_name"
            />
          </Field>
          <Field label="Duration Column">
            <Input
              name="tracesDurationColumn"
              width={40}
              value={jsonData.tracesDurationColumn || ''}
              onChange={onUpdateDatasourceJsonDataOption(props, 'tracesDurationColumn')}
              aria-label="Duration Column"
              placeholder="duration"
            />
          </Field>
          <Field label="Duration Unit" description="Unit of the duration column (ns, us, ms, s)">
            <Input
              name="tracesDurationUnit"
              width={20}
              value={jsonData.tracesDurationUnit || ''}
              onChange={onUpdateDatasourceJsonDataOption(props, 'tracesDurationUnit')}
              aria-label="Duration Unit"
              placeholder="ms"
            />
          </Field>
          <Field label="Start Time Column">
            <Input
              name="tracesStartTimeColumn"
              width={40}
              value={jsonData.tracesStartTimeColumn || ''}
              onChange={onUpdateDatasourceJsonDataOption(props, 'tracesStartTimeColumn')}
              aria-label="Start Time Column"
              placeholder="timestamp"
            />
          </Field>
        </ConfigSubSection>
        <ConfigSubSection title="Data Links">
          <Field label="Show Trace Links" description="Show clickable trace visualization links on TraceId fields">
            <Switch
              value={jsonData.showTraceLinks !== false}
              onChange={(e) => onJsonDataChange('showTraceLinks', e.currentTarget.checked)}
            />
          </Field>
        </ConfigSubSection>
      </ConfigSection>
    </>
  );
};