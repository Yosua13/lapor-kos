package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

type AIServiceInterface interface {
	GenerateEmpathicResponse(ctx context.Context, category, title, description string) (string, error)
	GenerateGroupWarning(ctx context.Context, description string) (string, error)
}

type AIService struct {
	apiKey string
}

func NewAIService() *AIService {
	return &AIService{
		apiKey: os.Getenv("GEMINI_API_KEY"),
	}
}

type geminiRequest struct {
	Contents []geminiContent `json:"contents"`
}

type geminiContent struct {
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text string `json:"text"`
}

type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

func (s *AIService) callGemini(ctx context.Context, prompt string) (string, error) {
	if s.apiKey == "" {
		return "", fmt.Errorf("GEMINI_API_KEY is not set")
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=%s", s.apiKey)

	reqPayload := geminiRequest{
		Contents: []geminiContent{
			{
				Parts: []geminiPart{
					{Text: prompt},
				},
			},
		},
	}

	jsonData, err := json.Marshal(reqPayload)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("gemini API returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var geminiResp geminiResponse
	if err := json.Unmarshal(bodyBytes, &geminiResp); err != nil {
		return "", err
	}

	if len(geminiResp.Candidates) > 0 &&
		len(geminiResp.Candidates[0].Content.Parts) > 0 {
		return strings.TrimSpace(geminiResp.Candidates[0].Content.Parts[0].Text), nil
	}

	return "", fmt.Errorf("no response text from gemini")
}

func (s *AIService) GenerateEmpathicResponse(ctx context.Context, category, title, description string) (string, error) {
	prompt := fmt.Sprintf(`Anda adalah asisten AI dari aplikasi "Lapor Kos". Seorang penghuni kos mengirimkan keluhan/komplain berikut:
Kategori: %s
Judul: %s
Deskripsi: %s

Tugas Anda:
Berikan tanggapan otomatis (dalam bahasa Indonesia) yang sangat empatik, sopan, menenangkan, dan solutif. Jelaskan bahwa laporan telah diterima sistem dan akan diteruskan ke pemilik kos untuk segera ditindaklanjuti. Jika kategori adalah "noisy" (keributan), tambahkan info bahwa sistem akan mengirimkan pesan teguran otomatis ke grup WhatsApp kosan agar suasana kembali kondusif secara anonim.
Buat jawaban singkat (maksimal 3-4 kalimat). Jangan gunakan format markdown tebal (* atau **) berlebihan, berikan teks polos yang rapi.`, category, title, description)

	res, err := s.callGemini(ctx, prompt)
	if err == nil && res != "" {
		return res, nil
	}

	log.Printf("Gemini AI failed or not configured, using fallback. Error: %v\n", err)
	return s.getFallbackEmpathicResponse(category), nil
}

func (s *AIService) GenerateGroupWarning(ctx context.Context, description string) (string, error) {
	prompt := fmt.Sprintf(`Seorang penghuni kos mengadukan masalah keributan di jam malam/istirahat:
Detail Laporan: "%s"

Tugas Anda:
Generate satu pesan teguran untuk dikirim ke Grup WhatsApp kos-kosan. 
Aturan:
1. Harus menggunakan bahasa Indonesia yang sopan, santun, tetapi tegas.
2. Harus singkat (cukup 1-2 kalimat).
3. JANGAN PERNAH menyebutkan nama pelapor atau nomor kamar pelapor demi keamanan (anonimitas total).
4. Buat agar terkesan sebagai himbauan umum/notifikasi dari sistem Lapor Kos untuk kenyamanan bersama.
5. JANGAN gunakan tanda petik atau markdown tebal (*). Berikan teks polos untuk chat WhatsApp.

Contoh yang baik:
"Himbauan Sistem Lapor Kos: Mohon perhatian rekan-rekan penghuni kos untuk bersama-sama menjaga ketenangan, terutama di atas jam 10 malam agar tidak mengganggu penghuni lain yang sedang beristirahat. Terima kasih atas pengertiannya."`, description)

	res, err := s.callGemini(ctx, prompt)
	if err == nil && res != "" {
		return res, nil
	}

	log.Printf("Gemini AI failed or not configured for WA warning, using fallback. Error: %v\n", err)
	return "Himbauan Lapor Kos: Mohon perhatian bagi seluruh rekan-rekan penghuni untuk menjaga ketenangan dan kekondusifan kosan, khususnya pada jam malam/istirahat, agar tidak mengganggu penghuni lain. Terima kasih atas pengertian dan kerja samanya.", nil
}

func (s *AIService) getFallbackEmpathicResponse(category string) string {
	switch category {
	case "noisy":
		return "Terima kasih atas laporan Anda. Kami memahami bahwa ketenangan sangat penting untuk kenyamanan Anda. Laporan keributan ini telah kami terima dan sistem telah mengirimkan pesan teguran sopan secara anonim ke grup WhatsApp kosan untuk mengingatkan agar menjaga ketenangan. Semoga situasi segera kondusif kembali."
	case "facility":
		return "Laporan kerusakan fasilitas Anda telah kami terima dengan baik. Kami meminta maaf atas ketidaknyamanan yang terjadi. Laporan ini telah diteruskan langsung ke pemilik kos untuk segera dijadwalkan perbaikan atau pemeriksaan. Terima kasih atas kerja samanya."
	case "cleanliness":
		return "Terima kasih telah melaporkan masalah kebersihan ini. Kenyamanan dan kebersihan lingkungan kos adalah prioritas bersama. Pengelola kos telah dinotifikasi untuk melakukan pengecekan dan tindakan kebersihan secepatnya."
	case "security":
		return "Laporan mengenai masalah keamanan telah kami terima dan menjadi perhatian serius kami. Kami telah meneruskannya ke pemilik kos untuk penanganan segera. Tetap berhati-hati dan laporkan jika melihat hal mencurigakan lainnya."
	default:
		return "Terima kasih atas laporan pengaduan Anda. Informasi ini telah berhasil kami catat dan langsung kami sampaikan kepada pengelola/pemilik kos untuk dievaluasi dan ditindaklanjuti sesegera mungkin demi kenyamanan bersama."
	}
}
