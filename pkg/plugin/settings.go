package plugin

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// Settings - data loaded from grafana settings database
type Settings struct {
	DSN      string `json:"dsn"`
	Password string `json:"-,omitempty"`
}

func (settings *Settings) isValid() (err error) {
	if settings.DSN == "" {
		return ErrorMessageInvalidDSN
	}
	return nil
}

// LoadSettings will read and validate Settings from the DataSourceConfig
func LoadSettings(config backend.DataSourceInstanceSettings) (settings Settings, err error) {
	var jsonData map[string]interface{}
	if err := json.Unmarshal(config.JSONData, &jsonData); err != nil {
		return settings, fmt.Errorf("%s: %w", err.Error(), ErrorMessageInvalidJSON)
	}
	if jsonData["dsn"] != nil {
		settings.DSN = jsonData["dsn"].(string)
	}
	password, ok := config.DecryptedSecureJSONData["password"]
	if ok {
		settings.Password = password
	}
	return settings, settings.isValid()
}
