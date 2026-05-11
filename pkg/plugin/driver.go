package plugin

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
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

// transformTraceAttributes transforms JSON fields (tags, serviceTags) in trace frames
// into the [{"key":"k","value":"v"}] format that Grafana's trace panel expects.
// Supports multiple input formats:
//   - Flat map: {"k":"v"} → [{"key":"k","value":"v"}]
//   - OTel attribute map: {"k":{"stringValue":"v"}} → [{"key":"k","value":"v"}]
//   - OTel attribute array: [{"key":"k","value":{"stringValue":"v"}}] → [{"key":"k","value":"v"}]
//   - Full OTel metadata blob: auto-extracts attributes or resource.attributes
//   - Already correct format: [{"key":"k","value":"v"}] → pass through
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
			transformed := transformToKeyValueArray(raw, name)
			frame.Fields[i].Set(j, transformed)
		}
	}
}

// transformToKeyValueArray converts various JSON formats into [{"key":"k","value":"v"}].
func transformToKeyValueArray(raw json.RawMessage, fieldName string) json.RawMessage {
	if len(raw) == 0 {
		return json.RawMessage("[]")
	}

	// Try as array first (OTel array format or already correct)
	var arr []interface{}
	if err := json.Unmarshal(raw, &arr); err == nil {
		return transformArrayFormat(arr)
	}

	// Try as object
	var obj map[string]interface{}
	if err := json.Unmarshal(raw, &obj); err == nil {
		return transformObjectFormat(obj, fieldName)
	}

	// Fallback: return empty array
	return json.RawMessage("[]")
}

// transformArrayFormat handles [{"key":"k","value":{"stringValue":"v"}}] or [{"key":"k","value":"v"}]
func transformArrayFormat(arr []interface{}) json.RawMessage {
	kvPairs := make([]map[string]string, 0, len(arr))
	for _, item := range arr {
		m, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		key, _ := m["key"].(string)
		if key == "" {
			continue
		}
		value := unwrapOTelValue(m["value"])
		kvPairs = append(kvPairs, map[string]string{"key": key, "value": value})
	}
	result, err := json.Marshal(kvPairs)
	if err != nil {
		return json.RawMessage("[]")
	}
	return json.RawMessage(result)
}

// transformObjectFormat handles {"k":"v"} or {"k":{"stringValue":"v"}}
// Also detects full OTel metadata blobs and extracts the appropriate sub-field:
//   - For "tags": extracts obj["attributes"]
//   - For "serviceTags": extracts obj["resource"]["attributes"]
func transformObjectFormat(obj map[string]interface{}, fieldName string) json.RawMessage {
	// Detect full OTel metadata blob: has "attributes" + "resource" keys
	if _, hasAttrs := obj["attributes"]; hasAttrs {
		if resource, hasResource := obj["resource"]; hasResource {
			if fieldName == "serviceTags" {
				// Extract resource.attributes for serviceTags
				if resMap, ok := resource.(map[string]interface{}); ok {
					if resAttrs, ok := resMap["attributes"]; ok {
						if resArr, ok := resAttrs.([]interface{}); ok {
							return transformArrayFormat(resArr)
						}
					}
				}
				return json.RawMessage("[]")
			}
			// Extract attributes for tags
			if attrMap, ok := obj["attributes"].(map[string]interface{}); ok {
				return transformObjectFormat(attrMap, "")
			}
		}
	}

	kvPairs := make([]map[string]string, 0, len(obj))
	for k, v := range obj {
		value := unwrapOTelValue(v)
		kvPairs = append(kvPairs, map[string]string{"key": k, "value": value})
	}
	result, err := json.Marshal(kvPairs)
	if err != nil {
		return json.RawMessage("[]")
	}
	return json.RawMessage(result)
}

// unwrapOTelValue extracts the actual value from OTel protobuf JSON wrappers.
// Handles: {"stringValue":"v"}, {"intValue":"123"}, {"boolValue":true},
// {"doubleValue":1.5}, {"arrayValue":{...}}, {"kvlistValue":{...}}, or plain values.
func unwrapOTelValue(v interface{}) string {
	switch val := v.(type) {
	case string:
		return val
	case float64:
		if val == float64(int64(val)) {
			return fmt.Sprintf("%d", int64(val))
		}
		return fmt.Sprintf("%g", val)
	case bool:
		return fmt.Sprintf("%t", val)
	case map[string]interface{}:
		// OTel typed value wrapper
		if sv, ok := val["stringValue"]; ok {
			s, _ := sv.(string)
			return s
		}
		if iv, ok := val["intValue"]; ok {
			switch n := iv.(type) {
			case string:
				return n
			case float64:
				return fmt.Sprintf("%d", int64(n))
			}
		}
		if bv, ok := val["boolValue"]; ok {
			b, _ := bv.(bool)
			return fmt.Sprintf("%t", b)
		}
		if dv, ok := val["doubleValue"]; ok {
			d, _ := dv.(float64)
			return fmt.Sprintf("%g", d)
		}
		// Complex value: marshal as JSON string
		b, _ := json.Marshal(val)
		return string(b)
	case nil:
		return ""
	default:
		b, _ := json.Marshal(val)
		return string(b)
	}
}
