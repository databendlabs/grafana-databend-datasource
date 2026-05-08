package plugin

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// SchemaProvider provides schema information (databases, tables, columns) for the query builder
type SchemaProvider struct {
	databendPlugin *Databend
	settings       backend.DataSourceInstanceSettings
}

// Column represents a database column with its name and type
type Column struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

// NewSchemaProvider creates a new SchemaProvider instance
func NewSchemaProvider(plugin *Databend, settings backend.DataSourceInstanceSettings) *SchemaProvider {
	return &SchemaProvider{databendPlugin: plugin, settings: settings}
}

// Databases returns a list of all databases
func (s *SchemaProvider) Databases(ctx context.Context) ([]string, error) {
	db, err := s.getDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	rows, err := db.QueryContext(ctx, "SHOW DATABASES")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var databases []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		databases = append(databases, name)
	}
	return databases, rows.Err()
}

// Tables returns a list of tables for a given database
func (s *SchemaProvider) Tables(ctx context.Context, database string) ([]string, error) {
	db, err := s.getDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	query := fmt.Sprintf("SHOW TABLES FROM %s", database)
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		tables = append(tables, name)
	}
	return tables, rows.Err()
}

// Columns returns a list of columns for a given database and table
func (s *SchemaProvider) Columns(ctx context.Context, database, table string) ([]Column, error) {
	db, err := s.getDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	query := fmt.Sprintf("DESCRIBE %s.%s", database, table)
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var columns []Column
	for rows.Next() {
		var col Column
		var extra string
		if err := rows.Scan(&col.Name, &col.Type, &extra); err != nil {
			// Try with just 2 columns if DESCRIBE returns fewer fields
			if err2 := rows.Scan(&col.Name, &col.Type); err2 != nil {
				return nil, err
			}
		}
		columns = append(columns, col)
	}
	return columns, rows.Err()
}

func (s *SchemaProvider) getDB(ctx context.Context) (*sql.DB, error) {
	return s.databendPlugin.Connect(ctx, s.settings, nil)
}

// Close is a no-op for SchemaProvider
func (s *SchemaProvider) Close() error {
	return nil
}
