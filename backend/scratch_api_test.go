package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
)

type LoginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResp struct {
	Token string `json:"token"`
}

func main() {
	// 1. Login
	loginReq := LoginReq{
		Email:    "reyyosua29@gmail.com",
		Password: "123456",
	}
	body, _ := json.Marshal(loginReq)
	resp, err := http.Post("http://localhost:8081/api/auth/login", "application/json", bytes.NewBuffer(body))
	if err != nil {
		log.Fatalf("Failed to login: %v\n", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		log.Fatalf("Login failed with status %d: %s\n", resp.StatusCode, string(respBody))
	}

	var authResp AuthResp
	json.NewDecoder(resp.Body).Decode(&authResp)
	token := authResp.Token
	fmt.Printf("Login successful. Token: %s...\n\n", token[:20])

	// 2. Fetch contracts
	req, _ := http.NewRequest("GET", "http://localhost:8081/api/contracts", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	client := &http.Client{}
	resp2, err := client.Do(req)
	if err != nil {
		log.Fatalf("Failed to fetch contracts: %v\n", err)
	}
	defer resp2.Body.Close()

	bodyBytes, _ := io.ReadAll(resp2.Body)
	fmt.Println("--- GET /api/contracts Response ---")
	
	// Pretty print
	var prettyJSON bytes.Buffer
	if err := json.Indent(&prettyJSON, bodyBytes, "", "  "); err == nil {
		fmt.Println(prettyJSON.String())
	} else {
		fmt.Println(string(bodyBytes))
	}
}
