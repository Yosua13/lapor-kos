package config

// MidtransConfig carries optional Midtrans Snap payment gateway settings.
type MidtransConfig struct {
	ServerKey    string
	ClientKey    string
	IsProduction bool
	SnapURL      string
}
