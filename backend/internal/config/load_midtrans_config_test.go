package config

import (
	"testing"
)

func TestLoadMidtransConfigDefaultsAndOverrides(t *testing.T) {
	t.Setenv("MIDTRANS_SERVER_KEY", "SB-Mid-server-abc")
	t.Setenv("MIDTRANS_CLIENT_KEY", "SB-Mid-client-xyz")
	t.Setenv("MIDTRANS_IS_PRODUCTION", "false")
	t.Setenv("MIDTRANS_SNAP_URL", "")

	cfg, err := loadMidtransConfig()
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if cfg.ServerKey != "SB-Mid-server-abc" {
		t.Errorf("unexpected ServerKey: %s", cfg.ServerKey)
	}
	if cfg.ClientKey != "SB-Mid-client-xyz" {
		t.Errorf("unexpected ClientKey: %s", cfg.ClientKey)
	}
	if cfg.IsProduction {
		t.Errorf("expected IsProduction false, got true")
	}
	if cfg.SnapURL != DefaultMidtransSandboxSnapURL {
		t.Errorf("expected SnapURL %s, got %s", DefaultMidtransSandboxSnapURL, cfg.SnapURL)
	}

	// Production default URL
	t.Setenv("MIDTRANS_IS_PRODUCTION", "true")
	prodCfg, err := loadMidtransConfig()
	if err != nil {
		t.Fatalf("expected no error for prod config, got: %v", err)
	}
	if !prodCfg.IsProduction {
		t.Errorf("expected IsProduction true")
	}
	if prodCfg.SnapURL != DefaultMidtransProductionSnapURL {
		t.Errorf("expected prod SnapURL %s, got %s", DefaultMidtransProductionSnapURL, prodCfg.SnapURL)
	}

	// Invalid boolean
	t.Setenv("MIDTRANS_IS_PRODUCTION", "not-a-bool")
	if _, err := loadMidtransConfig(); err == nil {
		t.Fatal("expected error for invalid MIDTRANS_IS_PRODUCTION")
	}
}
