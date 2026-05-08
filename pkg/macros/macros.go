package macros

import (
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
)

type timeQueryType string

const (
	timeQueryTypeFrom timeQueryType = "from"
	timeQueryTypeTo   timeQueryType = "to"
)

func formatDateTime(t time.Time) string {
	return fmt.Sprintf("'%s'", t.UTC().Format("2006-01-02 15:04:05"))
}

func formatDateTimeMS(t time.Time) string {
	return fmt.Sprintf("'%s'", t.UTC().Format("2006-01-02 15:04:05.000"))
}

func formatDate(t time.Time) string {
	return fmt.Sprintf("'%s'", t.UTC().Format("2006-01-02"))
}

// FromTimeFilter returns the from time as a formatted timestamp string
func FromTimeFilter(query *sqlutil.Query, args []string) (string, error) {
	return formatDateTime(query.TimeRange.From), nil
}

// ToTimeFilter returns the to time as a formatted timestamp string
func ToTimeFilter(query *sqlutil.Query, args []string) (string, error) {
	return formatDateTime(query.TimeRange.To), nil
}

// FromTimeMSFilter returns the from time with millisecond precision
func FromTimeMSFilter(query *sqlutil.Query, args []string) (string, error) {
	return formatDateTimeMS(query.TimeRange.From), nil
}

// ToTimeMSFilter returns the to time with millisecond precision
func ToTimeMSFilter(query *sqlutil.Query, args []string) (string, error) {
	return formatDateTimeMS(query.TimeRange.To), nil
}

// TimeFilter generates a time range filter for a column: col >= 'from' AND col <= 'to'
func TimeFilter(query *sqlutil.Query, args []string) (string, error) {
	if len(args) != 1 {
		return "", fmt.Errorf("%w: expected 1 argument, received %d", sqlutil.ErrorBadArgumentCount, len(args))
	}
	column := strings.TrimSpace(args[0])
	from := formatDateTime(query.TimeRange.From)
	to := formatDateTime(query.TimeRange.To)
	return fmt.Sprintf("%s >= %s AND %s <= %s", column, from, column, to), nil
}

// TimeFilterMS generates a time range filter with millisecond precision
func TimeFilterMS(query *sqlutil.Query, args []string) (string, error) {
	if len(args) != 1 {
		return "", fmt.Errorf("%w: expected 1 argument, received %d", sqlutil.ErrorBadArgumentCount, len(args))
	}
	column := strings.TrimSpace(args[0])
	from := formatDateTimeMS(query.TimeRange.From)
	to := formatDateTimeMS(query.TimeRange.To)
	return fmt.Sprintf("%s >= %s AND %s <= %s", column, from, column, to), nil
}

// DateFilter generates a date-only range filter for a column
func DateFilter(query *sqlutil.Query, args []string) (string, error) {
	if len(args) != 1 {
		return "", fmt.Errorf("%w: expected 1 argument, received %d", sqlutil.ErrorBadArgumentCount, len(args))
	}
	column := strings.TrimSpace(args[0])
	from := formatDate(query.TimeRange.From)
	to := formatDate(query.TimeRange.To)
	return fmt.Sprintf("%s >= %s AND %s <= %s", column, from, column, to), nil
}

// DateTimeFilter generates a datetime filter (alias for TimeFilter)
func DateTimeFilter(query *sqlutil.Query, args []string) (string, error) {
	return TimeFilter(query, args)
}

// TimeInterval generates a DATE_TRUNC based interval grouping expression
func TimeInterval(query *sqlutil.Query, args []string) (string, error) {
	if len(args) != 1 {
		return "", fmt.Errorf("%w: expected 1 argument, received %d", sqlutil.ErrorBadArgumentCount, len(args))
	}
	column := strings.TrimSpace(args[0])
	interval := query.Interval.Seconds()
	unit, val := intervalToUnitValue(interval)
	if val == 1 {
		return fmt.Sprintf("DATE_TRUNC(%s, %s)", unit, column), nil
	}
	return fmt.Sprintf("TO_TIMESTAMP(FLOOR(TO_UNIX_TIMESTAMP(%s) / %d) * %d)", column, int64(interval), int64(interval)), nil
}

// TimeIntervalMS generates a DATE_TRUNC based interval grouping with ms precision
func TimeIntervalMS(query *sqlutil.Query, args []string) (string, error) {
	if len(args) != 1 {
		return "", fmt.Errorf("%w: expected 1 argument, received %d", sqlutil.ErrorBadArgumentCount, len(args))
	}
	column := strings.TrimSpace(args[0])
	intervalMS := query.Interval.Milliseconds()
	return fmt.Sprintf("TO_TIMESTAMP(FLOOR(TO_UNIX_TIMESTAMP(%s) * 1000 / %d) * %d / 1000)", column, intervalMS, intervalMS), nil
}

// IntervalSeconds returns the interval duration in seconds as a string
func IntervalSeconds(query *sqlutil.Query, args []string) (string, error) {
	return fmt.Sprintf("%d", int64(query.Interval.Seconds())), nil
}

// intervalToUnitValue converts seconds to a Databend DATE_TRUNC unit
func intervalToUnitValue(seconds float64) (string, int) {
	switch {
	case seconds <= 1:
		return "'second'", 1
	case seconds < 60:
		if int(seconds)%1 == 0 {
			return "'second'", int(seconds)
		}
		return "'second'", int(seconds)
	case seconds < 3600:
		mins := int(seconds) / 60
		if int(seconds)%60 == 0 && (mins == 1 || mins == 5 || mins == 10 || mins == 15 || mins == 30) {
			return "'minute'", mins
		}
		return "'minute'", mins
	case seconds < 86400:
		hours := int(seconds) / 3600
		if int(seconds)%3600 == 0 {
			return "'hour'", hours
		}
		return "'hour'", hours
	default:
		days := int(seconds) / 86400
		if int(seconds)%86400 == 0 {
			return "'day'", days
		}
		return "'day'", days
	}
}

// Macros is the map of all supported macro functions
var Macros = sqlutil.Macros{
	"fromTime":        FromTimeFilter,
	"toTime":          ToTimeFilter,
	"fromTime_ms":     FromTimeMSFilter,
	"toTime_ms":       ToTimeMSFilter,
	"timeFilter":      TimeFilter,
	"timeFilter_ms":   TimeFilterMS,
	"dateFilter":      DateFilter,
	"dateTimeFilter":  DateTimeFilter,
	"dt":              DateTimeFilter,
	"timeInterval":    TimeInterval,
	"timeInterval_ms": TimeIntervalMS,
	"interval_s":      IntervalSeconds,
	// Legacy aliases
	"timeFrom": FromTimeFilter,
	"timeTo":   ToTimeFilter,
}
