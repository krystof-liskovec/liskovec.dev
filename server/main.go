package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"
)

type ThemeRequest struct {
	Prompt string `json:"prompt"`
}

type ThemeResponse struct {
	ThemeID    string            `json:"themeId"`
	Label      string            `json:"label"`
	Vars       map[string]string `json:"vars"`
	Shape      string            `json:"shape"`
	Type       string            `json:"type"`
	StatusText string            `json:"statusText"`
}

type OllamaRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
	Stream bool   `json:"stream"`
	Format string `json:"format,omitempty"`
}

type OllamaResponse struct {
	Response string `json:"response"`
}

func enableCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	http.HandleFunc("/api/theme", handleTheme)
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		enableCORS(w)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	log.Printf("Server starting on port %s...", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func handleTheme(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ThemeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	prompt := strings.TrimSpace(req.Prompt)
	if prompt == "" {
		prompt = "quiet"
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	resp, err := callLLM(ctx, prompt)
	if err != nil {
		log.Printf("LLM call failed/fallback for prompt '%s': %v", prompt, err)
		resp = generateFallbackTheme(prompt)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func callLLM(ctx context.Context, prompt string) (*ThemeResponse, error) {
	ollamaHost := os.Getenv("OLLAMA_HOST")
	if ollamaHost == "" {
		ollamaHost = "http://localhost:11434"
	}

	modelName := os.Getenv("OLLAMA_MODEL")
	if modelName == "" {
		modelName = "llama3"
	}

	sysPrompt := fmt.Sprintf(`You are a UI theme generator. Convert the user's prompt into a JSON visual theme palette.
Return ONLY raw JSON with these exact keys:
{
  "themeId": "custom",
  "label": "llm generated",
  "vars": {
    "--bg": "#hex",
    "--surface": "#hex",
    "--text": "#hex",
    "--muted": "#hex",
    "--accent": "#hex",
    "--second": "#hex",
    "--radius": "8px"
  },
  "shape": "organic",
  "type": "sans",
  "statusText": "llm engine"
}

Allowed shape values: "organic", "angular", "wave", "arch", "blob", "line"
Allowed type values: "sans", "serif", "mono"

User Prompt: %s`, prompt)

	ollamaReq := OllamaRequest{
		Model:  modelName,
		Prompt: sysPrompt,
		Stream: false,
		Format: "json",
	}

	reqBytes, err := json.Marshal(ollamaReq)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", ollamaHost+"/api/generate", bytes.NewReader(reqBytes))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 4 * time.Second}
	httpResp, err := client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer httpResp.Body.Close()

	if httpResp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ollama status code %d", httpResp.StatusCode)
	}

	bodyBytes, err := io.ReadAll(httpResp.Body)
	if err != nil {
		return nil, err
	}

	var ollamaRes OllamaResponse
	if err := json.Unmarshal(bodyBytes, &ollamaRes); err != nil {
		return nil, err
	}

	var themeResp ThemeResponse
	if err := json.Unmarshal([]byte(ollamaRes.Response), &themeResp); err != nil {
		return nil, err
	}

	return &themeResp, nil
}

func generateFallbackTheme(prompt string) *ThemeResponse {
	p := strings.ToLower(prompt)

	if regexp.MustCompile(`(frog|frogs|toad|moss|forest|jungle|leaf|leaves|plant|green|grass|emerald)`).MatchString(p) {
		return &ThemeResponse{
			ThemeID: "forest",
			Label:   "organic / calm",
			Vars: map[string]string{
				"--bg":      "#dfe6dc",
				"--surface": "#eef2e9",
				"--text":    "#28372d",
				"--muted":   "#718276",
				"--accent":  "#397050",
				"--second":  "#a8b984",
				"--radius":  "28px",
			},
			Shape:      "organic",
			Type:       "sans",
			StatusText: "go engine: green forest",
		}
	}

	if regexp.MustCompile(`(wood|wooden|timber|oak|mahogany|bark|brown|coffee|chocolate)`).MatchString(p) {
		return &ThemeResponse{
			ThemeID: "wood",
			Label:   "warm / timber",
			Vars: map[string]string{
				"--bg":      "#e8ded1",
				"--surface": "#f4ebd9",
				"--text":    "#34251a",
				"--muted":   "#8c7361",
				"--accent":  "#8a5229",
				"--second":  "#c48f57",
				"--radius":  "10px",
			},
			Shape:      "arch",
			Type:       "serif",
			StatusText: "go engine: warm timber",
		}
	}

	if regexp.MustCompile(`(stone|rock|slate|granite|pebble|concrete|mineral|grey|gray)`).MatchString(p) {
		return &ThemeResponse{
			ThemeID: "stone",
			Label:   "slate / mineral",
			Vars: map[string]string{
				"--bg":      "#dce0e3",
				"--surface": "#ebedf0",
				"--text":    "#1e2327",
				"--muted":   "#687078",
				"--accent":  "#4a5568",
				"--second":  "#94a3b8",
				"--radius":  "2px",
			},
			Shape:      "angular",
			Type:       "sans",
			StatusText: "go engine: slate mineral",
		}
	}

	if regexp.MustCompile(`(cyber|neon|space|matrix|future|digital|night|dark)`).MatchString(p) {
		return &ThemeResponse{
			ThemeID: "neon",
			Label:   "neon / future",
			Vars: map[string]string{
				"--bg":      "#111217",
				"--surface": "#1c1e26",
				"--text":    "#e8e8de",
				"--muted":   "#858893",
				"--accent":  "#d2f34b",
				"--second":  "#9b7cff",
				"--radius":  "0px",
			},
			Shape:      "angular",
			Type:       "mono",
			StatusText: "go engine: neon future",
		}
	}

	return &ThemeResponse{
		ThemeID: "quiet",
		Label:   "quiet / precise",
		Vars: map[string]string{
			"--bg":      "#ebe8e0",
			"--surface": "#f4f1e9",
			"--text":    "#242521",
			"--muted":   "#77766e",
			"--accent":  "#b85c3b",
			"--second":  "#d5c3a5",
			"--radius":  "2px",
		},
		Shape:      "organic",
		Type:       "serif",
		StatusText: "go engine: quiet",
	}
}
