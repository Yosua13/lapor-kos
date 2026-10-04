package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func TestAcceptContractRequiresExplicitPolicyConsent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	contractID := uuid.New()

	for _, test := range []struct {
		name string
		body string
		want int
	}{
		{name: "missing body", body: "", want: http.StatusBadRequest},
		{name: "consent declined", body: `{"policy_accepted":false}`, want: http.StatusUnprocessableEntity},
	} {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			context, _ := gin.CreateTestContext(recorder)
			context.Set("user_id", uuid.New().String())
			context.Params = gin.Params{{Key: "id", Value: contractID.String()}}
			context.Request = httptest.NewRequest(http.MethodPost, "/api/contracts/"+contractID.String()+"/accept", strings.NewReader(test.body))
			context.Request.Header.Set("Content-Type", "application/json")

			(&ContractHandler{}).AcceptContract(context)

			if recorder.Code != test.want {
				t.Fatalf("status=%d want=%d body=%s", recorder.Code, test.want, recorder.Body.String())
			}
		})
	}
}
