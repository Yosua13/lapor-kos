package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

var forbiddenBinaryExtensions = map[string]struct{}{
	".exe":   {},
	".dll":   {},
	".so":    {},
	".dylib": {},
}

var forbiddenUploadDirs = map[string]struct{}{
	"uploads":       {},
	"user-uploads":  {},
	"tmp":           {},
}

var allowedEnvFiles = map[string]struct{}{
	".env.example":        {},
	".env.docker.example": {},
}

func main() {
	root := "."
	if len(os.Args) > 1 {
		root = os.Args[1]
	}

	fmt.Printf("[CI Release Artifact Checker] Checking release tree at %s...\n", root)

	var violations []string

	// 1. Check all git tracked files
	cmd := exec.Command("git", "ls-files")
	output, err := cmd.Output()
	if err == nil {
		lines := strings.Split(string(output), "\n")
		for _, rawLine := range lines {
			line := strings.TrimSpace(rawLine)
			if line == "" {
				continue
			}

			base := filepath.Base(line)
			ext := strings.ToLower(filepath.Ext(line))

			// Check forbidden binary extensions in tracked repository files
			if _, ok := forbiddenBinaryExtensions[ext]; ok {
				violations = append(violations, fmt.Sprintf("Forbidden compiled binary tracked in repository: %s", line))
			}

			// Check forbidden .env files tracked in repository
			if strings.HasPrefix(base, ".env") {
				if _, ok := allowedEnvFiles[base]; !ok {
					violations = append(violations, fmt.Sprintf("Forbidden environment credential file tracked in repository: %s", line))
				}
			}

			// Check user uploads tracked in repository
			parts := strings.Split(filepath.ToSlash(line), "/")
			for _, part := range parts {
				if _, ok := forbiddenUploadDirs[strings.ToLower(part)]; ok {
					violations = append(violations, fmt.Sprintf("Forbidden user upload directory tracked in repository: %s", line))
				}
			}
		}
	}

	// 2. Check build output in frontend if .next exists
	frontendNextDir := filepath.Join(root, "frontend", ".next")
	if info, err := os.Stat(frontendNextDir); err == nil && info.IsDir() {
		_ = filepath.Walk(frontendNextDir, func(path string, info os.FileInfo, err error) error {
			if err != nil || info.IsDir() {
				return nil
			}
			base := filepath.Base(path)
			if strings.HasPrefix(base, ".env") {
				violations = append(violations, fmt.Sprintf("Forbidden environment file found in build output: %s", path))
			}
			ext := strings.ToLower(filepath.Ext(path))
			if _, ok := forbiddenBinaryExtensions[ext]; ok {
				violations = append(violations, fmt.Sprintf("Forbidden binary found in frontend build output: %s", path))
			}
			return nil
		})
	}

	if len(violations) > 0 {
		fmt.Fprintf(os.Stderr, "\n[FAIL] Release artifact validation failed with %d issue(s):\n", len(violations))
		for _, v := range violations {
			fmt.Fprintf(os.Stderr, "  - %s\n", v)
		}
		os.Exit(1)
	}

	fmt.Println("[PASS] Release artifacts are clean: zero credentials, zero local binaries, and zero user uploads.")
}
