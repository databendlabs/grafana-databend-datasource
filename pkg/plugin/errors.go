package plugin

import "errors"

var (
	ErrorMessageInvalidJSON = errors.New("could not parse json")
	ErrorMessageInvalidDSN  = errors.New("invalid dsn. Either empty or not set")
)
