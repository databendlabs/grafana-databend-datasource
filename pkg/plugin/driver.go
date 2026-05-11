package plugin

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/url"

	godatabend "github.com/datafuselabs/databend-go"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	"github.com/grafana/sqlds/v5"

	"github.com/databendlabs/grafana-databend-datasource/pkg/converters"
	"github.com/databendlabs/grafana-databend-datasource/pkg/macros"
)

const userAgent = "grafana-databend-datasource"

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
	cfg, err := godatabend.ParseDSN(dsn)
	if err != nil {
		return nil, err
	}
	cfg.UserAgent = userAgent
	return sql.OpenDB(cfg), nil
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
// It post-processes query result frames (e.g., converting JSON fields to strings).
func (d *Databend) MutateResponse(_ context.Context, res data.Frames) (data.Frames, error) {
	for _, frame := range res {
		if frame == nil {
			continue
		}

		if frame.Meta == nil {
			continue
		}

		if frame.Meta.PreferredVisualization == data.VisTypeTrace {
			transformTraceAttributes(frame)
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

// transformTraceAttributes transforms JSON object fields (tags, serviceTags) in trace frames
// from {"k1":"v1","k2":"v2"} to [{"key":"k1","value":"v1"},{"key":"k2","value":"v2"}]
// which is the format Grafana's trace panel expects.
func transformTraceAttributes(frame *data.Frame) {
	for i, field := range frame.Fields {
		if field.Type() != data.FieldTypeJSON {
			continue
		}
		name := field.Name
		if name != "tags" && name != "serviceTags" {
			continue
		}
		for j := 0; j < field.Len(); j++ {
			val := field.At(j)
			if val == nil {
				field.Set(j, json.RawMessage("[]"))
				continue
			}
			raw := val.(json.RawMessage)
			transformed := transformObjectToKeyValueArray(raw)
			frame.Fields[i].Set(j, transformed)
		}
	}
}

// transformObjectToKeyValueArray converts a JSON object like {"k":"v",...}
// into [{"key":"k","value":"v"},...] for Grafana's trace panel.
func transformObjectToKeyValueArray(raw json.RawMessage) json.RawMessage {
	var obj map[string]interface{}
	if err := json.Unmarshal(raw, &obj); err != nil {
		return raw
	}

	kvPairs := make([]map[string]string, 0, len(obj))
	for k, v := range obj {
		var strVal string
		switch val := v.(type) {
		case string:
			strVal = val
		default:
			b, _ := json.Marshal(val)
			strVal = string(b)
		}
		kvPairs = append(kvPairs, map[string]string{"key": k, "value": strVal})
	}

	result, err := json.Marshal(kvPairs)
	if err != nil {
		return raw
	}
	return json.RawMessage(result)
}
