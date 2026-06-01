package service

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

type WhatsAppServiceInterface interface {
	SendMessageToGroup(ctx context.Context, groupLinkOrID string, message string) (bool, error)
}

type WhatsAppService struct {
	apiURL   string
	apiToken string
}

func NewWhatsAppService() *WhatsAppService {
	return &WhatsAppService{
		apiURL:   os.Getenv("WHATSAPP_API_URL"),   // e.g. "https://api.fonnte.com/send"
		apiToken: os.Getenv("WHATSAPP_API_TOKEN"), // Fonnte token or custom gateway token
	}
}

func (s *WhatsAppService) SendMessageToGroup(ctx context.Context, groupLinkOrID string, message string) (bool, error) {
	if groupLinkOrID == "" {
		log.Println("[WHATSAPP SERVICE] Failed: Target group ID/link is empty")
		return false, fmt.Errorf("target group ID/link is empty")
	}

	// If no URL or Token is configured in .env, simulate/mock it
	if s.apiURL == "" || s.apiToken == "" {
		log.Printf("\n--- [SIMULATOR WHATSAPP GROUP SEND] ---\nTarget Link/ID: %s\nPesan: %s\n---------------------------------------\n", groupLinkOrID, message)
		return true, nil
	}

	// Prepare url-encoded parameters for general WhatsApp Gateways like Fonnte
	data := url.Values{}
	data.Set("target", groupLinkOrID)
	data.Set("message", message)

	req, err := http.NewRequestWithContext(ctx, "POST", s.apiURL, strings.NewReader(data.Encode()))
	if err != nil {
		return false, err
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	// Common header for authentication, e.g. Fonnte uses Authorization
	req.Header.Set("Authorization", s.apiToken)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[WHATSAPP SERVICE] HTTP Request failed: %v\n", err)
		return false, err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, err
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		log.Printf("[WHATSAPP SERVICE] API response error (status %d): %s\n", resp.StatusCode, string(bodyBytes))
		return false, fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	log.Printf("[WHATSAPP SERVICE] Message successfully sent to group %s. Response: %s\n", groupLinkOrID, string(bodyBytes))
	return true, nil
}
