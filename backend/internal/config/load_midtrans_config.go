package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

const (
	DefaultMidtransSandboxSnapURL    = "https://app.sandbox.midtrans.com/snap/v1/transactions"
	DefaultMidtransProductionSnapURL = "https://app.midtrans.com/snap/v1/transactions"
)

func loadMidtransConfig() (MidtransConfig, error) {
	isProd := false
	if rawProd := strings.TrimSpace(os.Getenv("MIDTRANS_IS_PRODUCTION")); rawProd != "" {
		parsed, err := strconv.ParseBool(rawProd)
		if err != nil {
			return MidtransConfig{}, fmt.Errorf("MIDTRANS_IS_PRODUCTION must be a boolean")
		}
		isProd = parsed
	}

	snapURL := strings.TrimSpace(os.Getenv("MIDTRANS_SNAP_URL"))
	if snapURL == "" {
		if isProd {
			snapURL = DefaultMidtransProductionSnapURL
		} else {
			snapURL = DefaultMidtransSandboxSnapURL
		}
	}

	if err := validateURLScheme("MIDTRANS_SNAP_URL", snapURL, "http", "https"); err != nil {
		return MidtransConfig{}, err
	}

	return MidtransConfig{
		ServerKey:    strings.TrimSpace(os.Getenv("MIDTRANS_SERVER_KEY")),
		ClientKey:    strings.TrimSpace(os.Getenv("MIDTRANS_CLIENT_KEY")),
		IsProduction: isProd,
		SnapURL:      snapURL,
	}, nil
}
