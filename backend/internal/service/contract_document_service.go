package service

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/jung-kurt/gofpdf"
)

type ContractDocumentService struct{}

func NewContractDocumentService() *ContractDocumentService { return &ContractDocumentService{} }

func (s *ContractDocumentService) Generate(version model.ContractVersion, contract model.Contract) ([]byte, string, error) {
	var snapshot map[string]any
	if err := json.Unmarshal(version.Snapshot, &snapshot); err != nil {
		return nil, "", fmt.Errorf("decode contract snapshot: %w", err)
	}
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetTitle(fmt.Sprintf("Kontrak %s versi %d", contract.ID, version.VersionNumber), false)
	pdf.SetAuthor("Lapor Kos", false)
	pdf.SetMargins(18, 18, 18)
	pdf.AddPage()
	pdf.SetFont("Helvetica", "B", 18)
	pdf.CellFormat(0, 10, "DOKUMEN KONTRAK SEWA", "", 1, "C", false, 0, "")
	pdf.SetFont("Helvetica", "", 10)
	pdf.CellFormat(0, 6, fmt.Sprintf("Kontrak %s | Versi %d", contract.ID.String(), version.VersionNumber), "", 1, "C", false, 0, "")
	pdf.Ln(5)
	pdf.SetFont("Helvetica", "B", 11)
	pdf.CellFormat(0, 7, "Snapshot kontrak", "B", 1, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 10)
	keys := make([]string, 0, len(snapshot))
	for key := range snapshot {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		value := fmt.Sprint(snapshot[key])
		value = strings.ReplaceAll(value, "\n", " ")
		pdf.SetFont("Helvetica", "B", 9)
		pdf.CellFormat(45, 6, humanizeContractKey(key), "", 0, "L", false, 0, "")
		pdf.SetFont("Helvetica", "", 9)
		pdf.MultiCell(0, 6, value, "", "L", false)
	}
	pdf.Ln(4)
	pdf.SetFont("Helvetica", "I", 8)
	pdf.MultiCell(0, 5, fmt.Sprintf("Dokumen ini diterbitkan dari snapshot immutable pada %s. Perubahan kontrak berikutnya akan menghasilkan versi dan dokumen baru.", time.Now().UTC().Format(time.RFC3339)), "", "L", false)
	var out bytes.Buffer
	if err := pdf.Output(&out); err != nil {
		return nil, "", fmt.Errorf("render contract PDF: %w", err)
	}
	sum := sha256.Sum256(out.Bytes())
	return out.Bytes(), hex.EncodeToString(sum[:]), nil
}

func humanizeContractKey(value string) string {
	value = strings.ReplaceAll(value, "_", " ")
	if value == "" {
		return value
	}
	return strings.ToUpper(value[:1]) + value[1:]
}
