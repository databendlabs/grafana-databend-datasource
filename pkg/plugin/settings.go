package plugin

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// Settings - data loaded from grafana settings database
type Settings struct {
	DSN             string `json:"dsn"`
	Password        string `json:"-"`
	DefaultDatabase string `json:"defaultDatabase"`
	QueryTimeout    string `json:"dialTimeout"`
	ForwardHeaders  bool   `json:"forwardGrafanaHeaders"`

	// Logs
	LogsDefaultTable  string `json:"logsTable"`
	LogsTimeColumn    string `json:"logsTimeColumn"`
	LogsLevelColumn   string `json:"logsLevelColumn"`
	LogsMessageColumn string `json:"logsMessageColumn"`

	// Traces
	TracesDefaultTable        string `json:"tracesTable"`
	TracesTraceIdColumn       string `json:"tracesTraceIdColumn"`
	TracesSpanIdColumn        string `json:"tracesSpanIdColumn"`
	TracesOperationNameColumn string `json:"tracesOperationNameColumn"`
	TracesServiceNameColumn   string `json:"tracesServiceNameColumn"`
	TracesDurationColumn      string `json:"tracesDurationColumn"`
	TracesDurationUnit        string `json:"tracesDurationUnit"`
	TracesStartTimeColumn     string `json:"tracesStartTimeColumn"`
}

func (s *Settings) isValid() error {
	if s.DSN == "" {
		return ErrorMessageInvalidDSN
	}
	return nil
}

// LoadSettings will read and validate Settings from the DataSourceConfig
func LoadSettings(config backend.DataSourceInstanceSettings) (Settings, error) {
	var settings Settings
	if err := json.Unmarshal(config.JSONData, &settings); err != nil {
		return settings, fmt.Errorf("%s: %w", err.Error(), ErrorMessageInvalidJSON)
	}
	password, ok := config.DecryptedSecureJSONData["password"]
	if ok {
		settings.Password = password
	}
	return settings, settings.isValid()
}

// GetTimeout returns the configured query timeout or a default of 60 seconds
func (s *Settings) GetTimeout() time.Duration {
	if s.QueryTimeout != "" {
		if t, err := strconv.Atoi(s.QueryTimeout); err == nil {
			return time.Duration(t) * time.Second
		}
	}
	return 60 * time.Second
}
