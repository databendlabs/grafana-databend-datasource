package plugin

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/sqlds/v5"
)

func NewDatasource(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	databendPlugin := &Databend{}
	ds := sqlds.NewDatasource(databendPlugin)

	pluginSettings, err := LoadSettings(settings)
	if err == nil && pluginSettings.ForwardHeaders {
		ds.EnableMultipleConnections = true
	}

	return ds.NewDatasource(ctx, settings)
}
