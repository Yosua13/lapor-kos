package main

import (
	"log"
	"os"
	"os/exec"
	"path/filepath"
)

func main() {
	backendDir := filepath.Join(".", "backend")
	cmd := exec.Command("go", append([]string{"run", "./cmd/api"}, os.Args[1:]...)...)
	cmd.Dir = backendDir
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Env = os.Environ()

	if err := cmd.Run(); err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			os.Exit(exitErr.ExitCode())
		}
		log.Fatalf("failed to run backend: %v", err)
	}
}
