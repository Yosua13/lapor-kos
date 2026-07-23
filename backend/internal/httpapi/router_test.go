package httpapi

import (
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/cron"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestRouterRegistersLegacyAndCanonicalPropertyRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router, err := NewRouter(nil, cron.NewBillingCron(nil), nil)
	require.NoError(t, err)

	routes := make(map[string]struct{})
	for _, route := range router.Routes() {
		routes[route.Method+" "+route.Path] = struct{}{}
	}
	for _, expected := range []string{
		"GET /api/properties",
		"GET /api/rooms",
		"GET /api/files/sign",
		"GET /api/v1/properties/:property_id/rooms",
		"GET /api/v1/properties/:property_id/files/sign",
		"PATCH /api/properties/:property_id/members/:membership_id",
	} {
		_, exists := routes[expected]
		require.Truef(t, exists, "route %s must be registered", expected)
	}
}
