import { DataSourcePlugin } from '@grafana/data';
import { DatabendDatasource } from './data/datasource';
import { ConfigEditor } from './components/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
import { DatabendConfig } from './types/config';
import { DatabendQuery } from './types/sql';

export const plugin = new DataSourcePlugin<DatabendDatasource, DatabendQuery, DatabendConfig>(DatabendDatasource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
