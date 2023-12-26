import React, { PureComponent } from 'react';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from '../datasource';
import { DatabendOptions, DatabendQuery } from '../types';
import { HorizontalGroup, Input, Label } from '@grafana/ui';

type Props = QueryEditorProps<DataSource, DatabendQuery, DatabendOptions>;

export class QueryEditor extends PureComponent<Props> {
  render() {
    return (
      <HorizontalGroup>
        <Label>SQL</Label>
        <Input
          type="string"
          label="SQL"
          value={this.props.query.sql}
          onChange={(e) => this.props.onChange({ ...this.props.query, sql: e.currentTarget.value })}
        />
      </HorizontalGroup>
    );
  }
}
