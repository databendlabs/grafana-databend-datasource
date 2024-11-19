package plugin

import (
	"database/sql"
	"encoding/json"
	"net/url"
	"time"

	_ "github.com/datafuselabs/databend-go"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	"github.com/grafana/sqlds/v2"

	"github.com/datafuselabs/grafana-databend-datasource/pkg/plugin/converters"
	"github.com/datafuselabs/grafana-databend-datasource/pkg/plugin/macros"
)

// Databend defines how to connect to a Databend datasource
type Databend struct{}

// Connect opens a sql.DB connection using datasource settings
func (d *Databend) Connect(config backend.DataSourceInstanceSettings, message json.RawMessage) (*sql.DB, error) {
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
	return map[string]sqlds.MacroFunc{
		"timeFrom":   macros.TimeFromFilter,
		"timeTo":     macros.TimeToFilter,
		"timeFilter": macros.TimeFilter,
		"dateFilter": macros.DateFilter,
	}
}

func (d *Databend) Settings(config backend.DataSourceInstanceSettings) sqlds.DriverSettings {
	timeout := 60
	// settings, err := LoadSettings(config)
	// if err == nil {
	// 	t, err := strconv.Atoi(settings.QueryTimeout)
	// 	if err == nil {
	// 		timeout = t
	// 	}
	// }
	return sqlds.DriverSettings{
		Timeout: time.Second * time.Duration(timeout),
		FillMode: &data.FillMissing{
			Mode: data.FillModeNull,
		},
	}
}
