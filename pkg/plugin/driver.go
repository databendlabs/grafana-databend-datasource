package plugin

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/url"
	"sort"
	"time"

	godatabend "github.com/datafuselabs/databend-go"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	"github.com/grafana/sqlds/v4"

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
// It post-processes query result frames (e.g., sorting by time, converting JSON fields to strings).
func (d *Databend) MutateResponse(_ context.Context, res data.Frames) (data.Frames, error) {
	for _, frame := range res {
		if frame == nil {
			continue
		}
		// Sort frame rows by the first time field in ascending order
		sortFrameByTime(frame)

		if frame.Meta == nil {
			continue
		}
		// For non-logs/traces/table visualizations, convert JSON fields to string
		if shouldConvertJSONFields(frame.Meta.PreferredVisualization) {
			convertJSONFieldsToString(frame)
		}
	}
	return res, nil
}

// sortFrameByTime sorts all rows in the frame by the first time field in ascending order.
// Grafana requires time series data to be sorted ascending by time.
func sortFrameByTime(frame *data.Frame) {
	if frame == nil || len(frame.Fields) == 0 {
		return
	}

	// Find the first time field
	timeFieldIdx := -1
	for i, field := range frame.Fields {
		if field.Type() == data.FieldTypeTime || field.Type() == data.FieldTypeNullableTime {
			timeFieldIdx = i
			break
		}
	}
	if timeFieldIdx < 0 {
		return
	}

	rowLen := frame.Fields[timeFieldIdx].Len()
	if rowLen <= 1 {
		return
	}

	// Build index slice and sort by time
	indices := make([]int, rowLen)
	for i := range indices {
		indices[i] = i
	}

	timeField := frame.Fields[timeFieldIdx]
	sort.SliceStable(indices, func(i, j int) bool {
		ti := getTimeValue(timeField, indices[i])
		tj := getTimeValue(timeField, indices[j])
		return ti.Before(tj)
	})

	// Check if already sorted
	sorted := true
	for i, idx := range indices {
		if i != idx {
			sorted = false
			break
		}
	}
	if sorted {
		return
	}

	// Reorder all fields according to sorted indices
	for fi, field := range frame.Fields {
		newField := data.NewFieldFromFieldType(field.Type(), rowLen)
		newField.Name = field.Name
		newField.Labels = field.Labels
		newField.Config = field.Config
		for i, idx := range indices {
			newField.Set(i, field.At(idx))
		}
		frame.Fields[fi] = newField
	}
}

// getTimeValue extracts a time.Time from a field at the given index, handling nullable types.
func getTimeValue(field *data.Field, idx int) time.Time {
	val := field.At(idx)
	if val == nil {
		return time.Time{}
	}
	switch v := val.(type) {
	case time.Time:
		return v
	case *time.Time:
		if v == nil {
			return time.Time{}
		}
		return *v
	default:
		return time.Time{}
	}
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
