//go:build mage
// +build mage

package main

import (
	"os"
	"path"

	"github.com/magefile/mage/mg"
	"github.com/magefile/mage/sh"

	build "github.com/grafana/grafana-plugin-sdk-go/build"
)

// Default configures the default target.
var Default = build.BuildAll

// Server builds the example server inside cmd/server
func Server() error {
	os.Chdir(path.Join("cmd", "server"))
	defer os.Chdir(path.Join("..", ".."))
	if err := sh.Run("go", "build", "-v"); err != nil {
		return err
	}
	return nil
}

// CleanAll runs the 'clean' target and also removes the example server binary in cmd/server
func CleanAll() error {
	mg.Deps(build.Clean)
	return os.Remove(path.Join("cmd", "server", "server"))
}

// TestAll runs all test for the backend (go test ./...), it's different than 'test', which runs tests only
// in the pkg package.
func TestAll() error {
	return sh.RunV("go", "test", "./...")
}
