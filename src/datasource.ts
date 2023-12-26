import { CoreApp, DataSourceInstanceSettings } from '@grafana/data';

import { DatabendQuery, DatabendOptions } from './types';
import { DataSourceWithBackend } from '@grafana/runtime';

export class DataSource extends DataSourceWithBackend<DatabendQuery, DatabendOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<DatabendOptions>) {
    super(instanceSettings);
  }

  getDefaultQuery(app: CoreApp): Partial<DatabendQuery> {
    return {};
  }

  filterQuery(query: DatabendQuery): boolean {
    if (query.hide) {
      return false;
    }
    return true;
  }
}
