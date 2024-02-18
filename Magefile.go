//go:build mage
// +build mage

package main

import (
	"fmt"
	"os"
	"path"
	"runtime"

	"github.com/magefile/mage/mg"
	"github.com/magefile/mage/sh"

	build "github.com/grafana/grafana-plugin-sdk-go/build"
)

// Default configures the default target.
var Default = build.BuildAll

// Build builds the plugin to dist directory for preview with docker compose.
func Build() error {
	os.Setenv("GOOS", "linux")
	// os.Chdir(path.Join("cmd", "server"))
	// defer os.Chdir(path.Join("..", ".."))
	output := path.Join("dist", fmt.Sprintf("gpx_databend_linux_%s", runtime.GOARCH))
	return sh.Run("go", "build", "-v", "-o", output, "pkg/main.go")
}

// CleanAll runs the 'clean' target and also removes the example server binary in cmd/server
func CleanAll() error {
	mg.Deps(build.Clean)
	return nil
}

// TestAll runs all test for the backend (go test ./...), it's different than 'test', which runs tests only
// in the pkg package.
func TestAll() error {
	return sh.RunV("go", "test", "./...")
}

func Coverage() error {
	return sh.RunV("go", "test", "./...", "-coverprofile=coverage.out")
}
