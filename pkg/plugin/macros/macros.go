package macros

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/sqlds/v2"
)

var (
	ErrorNoArgumentsToMacro           = errors.New("expected minimum of 1 argument. But no argument found")
	ErrorInsufficientArgumentsToMacro = errors.New("expected number of arguments not matching")
)

type timeQueryType string

const (
	timeQueryTypeFrom timeQueryType = "from"
	timeQueryTypeTo   timeQueryType = "to"
)

func formatDateTime(t time.Time) string {
	return fmt.Sprintf("TO_TIMESTAMP(%d)", t.UTC().Unix())
}

func formatDate(t time.Time) string {
	return fmt.Sprintf("TO_TIMESTAMP('%s')", t.Format("2006-01-02"))
}

func newTimeFilter(queryType timeQueryType, query *sqlds.Query) (string, error) {
	t := query.TimeRange.From
	if queryType == timeQueryTypeTo {
		t = query.TimeRange.To
	}
	return formatDateTime(t), nil
}

// TimeFromFilter return time filter query based on grafana's timepicker's from time
func TimeFromFilter(query *sqlds.Query, args []string) (string, error) {
	return newTimeFilter(timeQueryTypeFrom, query)
}

// TimeToFilter return time filter query based on grafana's timepicker's to time
func TimeToFilter(query *sqlds.Query, args []string) (string, error) {
	return newTimeFilter(timeQueryTypeTo, query)
}

func TimeFilter(query *sqlds.Query, args []string) (string, error) {
	if len(args) != 1 {
		return "", fmt.Errorf("%w: expected 1 argument, received %d", sqlds.ErrorBadArgumentCount, len(args))
	}
	var (
		column = args[0]
		from   = formatDateTime(query.TimeRange.From)
		to     = formatDateTime(query.TimeRange.To)
	)
	return fmt.Sprintf("%s >= %s AND %s <= %s", column, from, column, to), nil
}

func DateFilter(query *sqlds.Query, args []string) (string, error) {
	if len(args) != 1 {
		return "", fmt.Errorf("%w: expected 1 argument, received %d", sqlds.ErrorBadArgumentCount, len(args))
	}
	var (
		column = args[0]
		from   = formatDate(query.TimeRange.From)
		to     = formatDate(query.TimeRange.To)
	)
	return fmt.Sprintf("%s >= %s AND %s <= %s", column, from, column, to), nil
}

// RemoveQuotesInArgs remove all quotes from macro arguments and return
func RemoveQuotesInArgs(args []string) []string {
	updatedArgs := []string{}
	for _, arg := range args {
		replacer := strings.NewReplacer(
			"\"", "",
			"'", "",
		)
		updatedArgs = append(updatedArgs, replacer.Replace(arg))
	}
	return updatedArgs
}

// IsValidComparisonPredicates checks for a string and return true if it is a valid SQL comparison predicate
func IsValidComparisonPredicates(comparison_predicates string) bool {
	switch comparison_predicates {
	case "=", "!=", "<>", "<", "<=", ">", ">=":
		return true
	}
	return false
}
