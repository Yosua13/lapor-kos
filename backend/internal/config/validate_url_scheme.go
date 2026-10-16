package config

import (
	"fmt"
	"net/url"
	"strings"
)

// validateURLScheme ensures raw is a parseable URL with a host and one of the
// allowed schemes. The returned error never echoes the URL, so credentials
// embedded in it cannot leak into startup logs.
func validateURLScheme(name, raw string, allowedSchemes ...string) error {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" {
		return fmt.Errorf("%s must be a valid URL with a host", name)
	}
	for _, scheme := range allowedSchemes {
		if strings.EqualFold(parsed.Scheme, scheme) {
			return nil
		}
	}
	return fmt.Errorf("%s must use one of the schemes: %s", name, strings.Join(allowedSchemes, ", "))
}
