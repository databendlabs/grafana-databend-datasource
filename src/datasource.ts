import {
  DataQueryRequest,
  DataFrame,
  DataSourceInstanceSettings,
  MetricFindValue,
  ScopedVars,
} from "@grafana/data";
import { switchMap, map } from "rxjs/operators";
import { firstValueFrom } from "rxjs";

import { DatabendQuery, DatabendOptions } from "./types/sql";
import { DataSourceWithBackend, getTemplateSrv } from "@grafana/runtime";

export class DataSource extends DataSourceWithBackend<
  DatabendQuery,
  DatabendOptions
> {
  constructor(instanceSettings: DataSourceInstanceSettings<DatabendOptions>) {
    super(instanceSettings);
    this.annotations = {};
  }

  applyTemplateVariables(
    query: DatabendQuery,
    scopedVars: ScopedVars
  ): DatabendQuery {
    query.rawSql = getTemplateSrv().replace(query.rawSql, scopedVars);
    return query;
  }

  filterQuery(query: DatabendQuery): boolean {
    if (!query.rawSql) {
      return false;
    }
    if (query.hide) {
      return false;
    }
    return true;
  }

  async metricFindQuery(sql: string): Promise<MetricFindValue[]> {
    if (!sql) {
      return Promise.resolve([]);
    }

    return firstValueFrom(
      this.query({
        targets: [
          {
            rawSql: sql,
          },
        ],
        maxDataPoints: 0,
      } as DataQueryRequest<DatabendQuery>).pipe(
        switchMap((response) => {
          if (response.errors) {
            console.log("Error: " + response.errors[0].message);
            throw new Error(response.errors[0].message);
          }
          return response.data;
        }),
        switchMap((data: DataFrame) => {
          return data.fields;
        }),
        map((field) =>
          field.values.map((value) => {
            return { text: value };
          })
        )
      )
    );
  }
}
