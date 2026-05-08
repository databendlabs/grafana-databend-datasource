package plugin

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/url"

	_ "github.com/datafuselabs/databend-go"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	"github.com/grafana/sqlds/v4"

	"github.com/databendlabs/grafana-databend-datasource/pkg/converters"
	"github.com/databendlabs/grafana-databend-datasource/pkg/macros"
)

// Databend defines how to connect to a Databend datasource
type Databend struct{}

// Connect opens a sql.DB connection using datasource settings
func (d *Databend) Connect(ctx context.Context, config backend.DataSourceInstanceSettings, message json.RawMessage) (*sql.DB, error) {
	settings, err := LoadSettings(config)
	if err != nil {
		return nil, err
	}
	var dsn string
	// If password is set, override the DSN password
	if settings.Password != "" {
		u, err := url.Parse(settings.DSN)
		if err != nil {
			return nil, err
		}
		u.User = url.UserPassword(u.User.Username(), settings.Password)
		dsn = u.String()
	} else {
		dsn = settings.DSN
	}
	return sql.Open("databend", dsn)
}

// Converters defines list of data type converters
func (d *Databend) Converters() []sqlutil.Converter {
	return converters.DatabendConverters()
}

// Macros returns list of macro functions convert the macros of raw query
func (d *Databend) Macros() sqlds.Macros {
	return macros.Macros
}

// Settings are read whenever the plugin is initialized, or after the data source settings are updated
func (d *Databend) Settings(ctx context.Context, config backend.DataSourceInstanceSettings) sqlds.DriverSettings {
	settings, _ := LoadSettings(config)
	return sqlds.DriverSettings{
		Timeout: settings.GetTimeout(),
		FillMode: &data.FillMissing{
			Mode: data.FillModeNull,
		},
	}
}

// MutateResponse implements sqlds.ResponseMutator.
// It post-processes query result frames (e.g., converting JSON fields to strings for non-log/trace visualizations).
func (d *Databend) MutateResponse(_ context.Context, res data.Frames) (data.Frames, error) {
	for _, frame := range res {
		if frame == nil || frame.Meta == nil {
			continue
		}
		// For non-logs/traces/table visualizations, convert JSON fields to string
		if shouldConvertJSONFields(frame.Meta.PreferredVisualization) {
			convertJSONFieldsToString(frame)
		}
	}
	return res, nil
}

// shouldConvertJSONFields returns true if JSON fields should be converted to string for the given visualization type.
func shouldConvertJSONFields(visType data.VisType) bool {
	return visType != data.VisTypeTrace && visType != data.VisTypeTable && visType != data.VisTypeLogs
}

// convertJSONFieldsToString converts all FieldTypeJSON fields in the frame to string fields.
func convertJSONFieldsToString(frame *data.Frame) {
	for i, field := range frame.Fields {
		if field.Type() == data.FieldTypeJSON {
			newField := data.NewFieldFromFieldType(data.FieldTypeString, field.Len())
			newField.Name = field.Name
			newField.Labels = field.Labels
			for j := 0; j < field.Len(); j++ {
				val := field.At(j)
				if val == nil {
					newField.Set(j, "")
				} else {
					newField.Set(j, string(val.(json.RawMessage)))
				}
			}
			frame.Fields[i] = newField
		}
	}
}
