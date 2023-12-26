import React from 'react';
import { Divider, Field, Input, SecretInput } from '@grafana/ui';
import {
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceSecureJsonDataOption
} from '@grafana/data';
import { ConfigSection, DataSourceDescription } from '@grafana/experimental';
import { DatabendOptions, DatabendSecureOptions } from '../types';

export interface Props extends DataSourcePluginOptionsEditorProps<DatabendOptions> { }

export const ConfigEditor: React.FC<Props> = (props) => {
  const { options, onOptionsChange } = props;
  const { jsonData, secureJsonFields } = options;
  const secureJsonData = (options.secureJsonData || {}) as DatabendSecureOptions;

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

  return (
    <>
      <DataSourceDescription
        dataSourceName="Databend"
        docsLink="https://github.com/datafuselabs/grafana-databend-datasource"
        hasRequiredFields
      />
      <Divider />
      <ConfigSection title="Server">
        <Field required label="DSN" description="Data Source Name" invalid={!jsonData.dsn} error={'DSN is required'}>
          <Input
            name="dsn"
            width={50}
            value={jsonData.dsn || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'dsn')}
            label="Data Source Name"
            aria-label="DSN"
            placeholder="databend://root:@localhost:8000?sslmode=disable"
          />
        </Field>
      </ConfigSection>
      <Divider />
      <ConfigSection title="Security">
        <Field label="SQL User Password" description="Password to Override in DSN">
          <SecretInput
            name="pwd"
            width={50}
            label="SQL User Password"
            aria-label="Password"
            placeholder="password"
            value={secureJsonData.password || ''}
            isConfigured={(secureJsonFields && secureJsonFields.password) as boolean}
            onReset={onResetPassword}
            onChange={onUpdateDatasourceSecureJsonDataOption(props, 'password')}
          />
        </Field>
      </ConfigSection>
    </>
  );
}
