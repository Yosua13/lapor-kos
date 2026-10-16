package model

import "time"

// Dependency status values reported by infrastructure health probes.
const (
	// DependencyStatusConnected means the last probe reached the dependency.
	DependencyStatusConnected = "connected"
	// DependencyStatusDisconnected means the dependency is configured but
	// unreachable; the client keeps retrying in the background.
	DependencyStatusDisconnected = "disconnected"
	// DependencyStatusDisabled means the dependency is not configured and the
	// API intentionally runs without it.
	DependencyStatusDisabled = "disabled"
)

// DependencyHealth is the public, credential-free health view of an optional
// infrastructure dependency such as Redis or RabbitMQ.
//
// Error is a coarse category only; detailed (redacted) causes are written to
// server logs so unauthenticated probes never reveal hosts or credentials.
type DependencyHealth struct {
	Status            string     `json:"status"`
	Enabled           bool       `json:"enabled"`
	LatencyMs         float64    `json:"latency_ms"`
	Error             string     `json:"error,omitempty"`
	ReconnectAttempts int64      `json:"reconnect_attempts"`
	ConnectedSince    *time.Time `json:"connected_since,omitempty"`
	LastCheckedAt     *time.Time `json:"last_checked_at,omitempty"`
}
