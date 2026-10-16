package main

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

// SecretPattern defines a regex pattern for potential secret leaks.
type SecretPattern struct {
	Name    string
	Pattern *regexp.Regexp
}

var secretPatterns = []SecretPattern{
	{
		Name:    "Private Key Header",
		Pattern: regexp.MustCompile(`-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----`),
	},
	{
		Name:    "AWS Access Key ID",
		Pattern: regexp.MustCompile(`\bAKIA[0-9A-Z]{16}\b`),
	},
	{
		Name:    "Hardcoded Live Database Password in connection URI",
		Pattern: regexp.MustCompile(`postgres(ql)?:\/\/[a-zA-Z0-9_\-\.]+:[^@\s]+@(aws|ep-|db\.)[a-zA-Z0-9_\-\.]+\.supabase\.com`),
	},
	{
		Name:    "Generic High Entropy Token",
		Pattern: regexp.MustCompile(`(?i)(ghp_[0-9a-zA-Z]{36}|xox[baprs]-[0-9a-zA-Z]{10,48})`),
	},
}

var ignoredDirs = map[string]struct{}{
	".git":         {},
	"node_modules": {},
	".next":        {},
	"dist":         {},
	"build":        {},
	".system_generated": {},
	"vendor":       {},
}

var allowedFiles = map[string]struct{}{
	".env.example":        {},
	".env.docker.example": {},
}

func main() {
	root := "."
	if len(os.Args) > 1 {
		root = os.Args[1]
	}

	fmt.Printf("[CI Secret Scanner] Scanning repository at %s...\n", root)

	var violations []string

	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		// Skip ignored directories
		if info.IsDir() {
			name := info.Name()
			if _, ok := ignoredDirs[name]; ok {
				return filepath.SkipDir
			}
			return nil
		}

		baseName := filepath.Base(path)
		// Check for forbidden .env files
		if strings.HasPrefix(baseName, ".env") {
			if _, ok := allowedFiles[baseName]; !ok {
				// Don't fail for local development backend/.env if running locally,
				// but flag if in git index
				if !strings.Contains(path, "node_modules") {
					violations = append(violations, fmt.Sprintf("Forbidden environment file found: %s (only .env.example allowed)", path))
				}
			}
		}

		// Only scan code, markdown, yaml, json, sql, ps1, sh
		ext := strings.ToLower(filepath.Ext(path))
		scanExts := map[string]bool{
			".go": true, ".ts": true, ".tsx": true, ".js": true, ".jsx": true,
			".sql": true, ".yml": true, ".yaml": true, ".json": true, ".md": true,
			".ps1": true, ".sh": true,
		}
		if !scanExts[ext] {
			return nil
		}

		// Avoid scanning this scanner file itself
		if strings.Contains(path, "scan_secrets.go") {
			return nil
		}

		file, err := os.Open(path)
		if err != nil {
			return nil
		}
		defer file.Close()

		scanner := bufio.NewScanner(file)
		lineNum := 0
		for scanner.Scan() {
			lineNum++
			line := scanner.Text()

			// Skip comment descriptions or test placeholders
			if strings.Contains(line, "test-service-key") || strings.Contains(line, "dev-only-") || strings.Contains(line, "example.com") {
				continue
			}

			for _, sp := range secretPatterns {
				if sp.Pattern.MatchString(line) {
					violations = append(violations, fmt.Sprintf("%s (%s:%d) - Pattern '%s'", sp.Name, path, lineNum, sp.Name))
				}
			}
		}

		return nil
	})

	if err != nil {
		fmt.Fprintf(os.Stderr, "Error scanning: %v\n", err)
		os.Exit(1)
	}

	var realViolations []string
	for _, v := range violations {
		if strings.Contains(v, "Forbidden environment file found:") {
			// Extract file path from violation message
			parts := strings.Split(v, ": ")
			if len(parts) >= 2 {
				filePath := strings.Fields(parts[1])[0]
				cmd := exec.Command("git", "ls-files", "--error-unmatch", filePath)
				if err := cmd.Run(); err != nil {
					// File is NOT tracked in git (ignored by .gitignore), so it won't be committed or leaked in CI
					continue
				}
			}
		}
		realViolations = append(realViolations, v)
	}

	if len(realViolations) > 0 {
		fmt.Fprintf(os.Stderr, "\n[FAIL] Found %d security secret violation(s):\n", len(realViolations))
		for _, v := range realViolations {
			fmt.Fprintf(os.Stderr, "  - %s\n", v)
		}
		os.Exit(1)
	}

	fmt.Println("[PASS] No exposed secrets, live credentials, or private keys found in scanned files.")
}
