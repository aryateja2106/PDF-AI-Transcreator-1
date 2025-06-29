"use client";

import { useState, useRef } from "react";

type Language = {
  code: string;
  name: string;
  nativeName: string;
};

const languages: Language[] = [
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
];

type Step = "setup" | "upload" | "language" | "results" | "audio";

export default function ResearchReader() {
  const [currentStep, setCurrentStep] = useState<Step>("setup");
  const [extractedText, setExtractedText] = useState<string>("");
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(
    null
  );
  const [transcreatedText, setTranscreatedText] = useState<string>("");
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [transcreationId, setTranscreationId] = useState<number | null>(null);

  // API Keys state
  const [geminiApiKey, setGeminiApiKey] = useState<string>("");
  const [elevenlabsApiKey, setElevenlabsApiKey] = useState<string>("");

  // Token and Character Counts State
  const [estimatedTokens, setEstimatedTokens] = useState<number>(0);
  const [geminiTokensUsed, setGeminiTokensUsed] = useState<number>(0);
  const [elevenlabsCharsUsed, setElevenlabsCharsUsed] = useState<number>(0);

  const [pdfInfo, setPdfInfo] = useState<{
    pages: number;
    extractedPages: number;
    extractedLength: number;
    originalLength: number;
    wasTruncated: boolean;
  } | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file: File) => {
    console.log("File upload started:", file.name);

    if (file.type !== "application/pdf") {
      setError("Please upload a valid PDF file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB");
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      console.log("Sending file to API...");
      const response = await fetch("/api/extract-pdf", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      console.log("API response:", data);

      if (!response.ok) {
        throw new Error(data.error || "Failed to extract text from PDF");
      }

      setExtractedText(data.text);
      setDocumentId(data.documentId);
      setPdfInfo({
        pages: data.pages,
        extractedPages: data.extractedPages,
        extractedLength: data.extractedLength,
        originalLength: data.originalLength,
        wasTruncated: data.wasTruncated,
      });

      // Estimate tokens for the user (1 token ~ 4 chars)
      const estimated = Math.ceil(data.text.length / 4);
      setEstimatedTokens(estimated);

      setCurrentStep("language");
      console.log(
        "PDF extraction successful",
        data.cached ? "(cached)" : "(new)"
      );
    } catch (err) {
      console.error("PDF extraction failed:", err);
      setError(err instanceof Error ? err.message : "Failed to process PDF");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLanguageSelect = (language: Language) => {
    setSelectedLanguage(language);
  };

  const handleTranscreate = async () => {
    if (!selectedLanguage || !extractedText || !geminiApiKey) return;

    setIsProcessing(true);
    setError("");

    try {
      console.log("Starting transcreation to", selectedLanguage.name);
      const response = await fetch("/api/transcreate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: extractedText,
          targetLanguage: selectedLanguage.name,
          documentId: documentId,
          apiKey: geminiApiKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to transcreate content");
      }

      setTranscreatedText(data.transcreatedText);
      setTranscreationId(data.transcreationId);
      setGeminiTokensUsed(data.tokensUsed);
      setCurrentStep("results");
      console.log(
        "Transcreation successful",
        data.cached ? "(cached)" : "(new)"
      );
    } catch (err) {
      console.error("Transcreation failed:", err);
      setError(
        err instanceof Error ? err.message : "Failed to transcreate content"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!transcreatedText || !selectedLanguage || !elevenlabsApiKey) return;

    setIsProcessing(true);
    setError("");

    try {
      console.log("Generating audio for", selectedLanguage.name);
      const response = await fetch("/api/generate-audio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: transcreatedText,
          language: selectedLanguage.name,
          transcreationId: transcreationId,
          apiKey: elevenlabsApiKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate audio");
      }

      setAudioUrl(data.audioData);
      setElevenlabsCharsUsed(data.charactersUsed);
      setCurrentStep("audio");
      console.log(
        "Audio generation successful",
        data.cached ? "(cached)" : "(new)"
      );
    } catch (err) {
      console.error("Audio generation failed:", err);
      setError(err instanceof Error ? err.message : "Failed to generate audio");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetApp = () => {
    setCurrentStep("setup");
    setExtractedText("");
    setSelectedLanguage(null);
    setTranscreatedText("");
    setAudioUrl("");
    setDocumentId(null);
    setTranscreationId(null);
    setPdfInfo(null);
    setError("");
    setEstimatedTokens(0);
    setGeminiTokensUsed(0);
    setElevenlabsCharsUsed(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const canProceedFromSetup = geminiApiKey.trim().length > 0;
  const canGenerateAudio = elevenlabsApiKey.trim().length > 0;

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: "var(--color-background)",
        color: "var(--color-foreground)",
      }}
    >
      {/* Header */}
      <header
        className="border-b px-6 py-4"
        style={{
          backgroundColor: "var(--color-card)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--color-foreground)" }}
            >
              PDF AI Transcreator
            </h1>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              Extract • Transcreate • Listen
            </p>
          </div>
          <button
            onClick={resetApp}
            className="text-sm px-4 py-2 rounded-lg border transition-all duration-200 hover:opacity-80"
            style={{
              color: "var(--color-muted-foreground)",
              borderColor: "var(--color-border)",
              backgroundColor: "var(--color-secondary)",
            }}
          >
            Reset
          </button>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="flex items-center space-x-4 mb-8">
          {[
            { key: "setup", label: "Setup", icon: "🔑" },
            { key: "upload", label: "Upload", icon: "📄" },
            { key: "language", label: "Language", icon: "🌍" },
            { key: "results", label: "Results", icon: "✨" },
            { key: "audio", label: "Audio", icon: "🎵" },
          ].map((step, index) => {
            const stepKeys = [
              "setup",
              "upload",
              "language",
              "results",
              "audio",
            ];
            const currentIndex = stepKeys.indexOf(currentStep);
            const stepIndex = stepKeys.indexOf(step.key);
            const isActive = step.key === currentStep;
            const isCompleted = stepIndex < currentIndex;

            return (
              <div key={step.key} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "text-white shadow-lg"
                      : isCompleted
                      ? "text-white"
                      : ""
                  }`}
                  style={{
                    backgroundColor:
                      isActive || isCompleted
                        ? "var(--color-primary)"
                        : "var(--color-muted)",
                    color:
                      isActive || isCompleted
                        ? "var(--color-primary-foreground)"
                        : "var(--color-muted-foreground)",
                  }}
                >
                  {step.icon}
                </div>
                <span
                  className={`ml-2 text-sm font-medium ${
                    isActive ? "font-semibold" : ""
                  }`}
                  style={{
                    color: isActive
                      ? "var(--color-foreground)"
                      : "var(--color-muted-foreground)",
                  }}
                >
                  {step.label}
                </span>
                {index < 4 && (
                  <div
                    className="w-8 h-0.5 mx-4"
                    style={{
                      backgroundColor: isCompleted
                        ? "var(--color-primary)"
                        : "var(--color-border)",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Error Display */}
        {error && (
          <div
            className="mb-6 p-4 rounded-lg border"
            style={{
              backgroundColor: "var(--color-destructive)",
              color: "var(--color-destructive-foreground)",
              borderColor: "var(--color-destructive)",
            }}
          >
            <p className="text-sm font-medium">⚠️ {error}</p>
          </div>
        )}

        {/* Step Content */}
        <div
          className="rounded-xl p-8 shadow-lg"
          style={{
            backgroundColor: "var(--color-card)",
            borderColor: "var(--color-border)",
          }}
        >
          {/* Setup Step */}
          {currentStep === "setup" && (
            <div className="text-center">
              <div className="mb-8">
                <h2
                  className="text-3xl font-bold mb-4"
                  style={{ color: "var(--color-foreground)" }}
                >
                  Welcome to PDF AI Transcreator
                </h2>
                <p
                  className="text-lg"
                  style={{ color: "var(--color-muted-foreground)" }}
                >
                  Get started by providing your API keys
                </p>
              </div>

              <div className="space-y-6 max-w-md mx-auto">
                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: "var(--color-foreground)" }}
                  >
                    Google Gemini API Key *
                  </label>
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="Enter your Gemini API key"
                    className="w-full px-4 py-3 rounded-lg border transition-all duration-200"
                    style={{
                      backgroundColor: "var(--color-background)",
                      borderColor: "var(--color-input)",
                      color: "var(--color-foreground)",
                    }}
                  />
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--color-muted-foreground)" }}
                  >
                    Required for text transcreation
                  </p>
                </div>

                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: "var(--color-foreground)" }}
                  >
                    ElevenLabs API Key
                  </label>
                  <input
                    type="password"
                    value={elevenlabsApiKey}
                    onChange={(e) => setElevenlabsApiKey(e.target.value)}
                    placeholder="Enter your ElevenLabs API key (optional)"
                    className="w-full px-4 py-3 rounded-lg border transition-all duration-200"
                    style={{
                      backgroundColor: "var(--color-background)",
                      borderColor: "var(--color-input)",
                      color: "var(--color-foreground)",
                    }}
                  />
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--color-muted-foreground)" }}
                  >
                    Optional - needed only for audio generation
                  </p>
                </div>

                <button
                  onClick={() => setCurrentStep("upload")}
                  disabled={!canProceedFromSetup}
                  className={`w-full py-3 px-6 rounded-lg font-medium transition-all duration-200 ${
                    canProceedFromSetup
                      ? "hover:opacity-90 shadow-lg"
                      : "opacity-50 cursor-not-allowed"
                  }`}
                  style={{
                    backgroundColor: canProceedFromSetup
                      ? "var(--color-primary)"
                      : "var(--color-muted)",
                    color: canProceedFromSetup
                      ? "var(--color-primary-foreground)"
                      : "var(--color-muted-foreground)",
                  }}
                >
                  Continue to Upload
                </button>
              </div>

              <div
                className="mt-8 pt-6 border-t"
                style={{ borderColor: "var(--color-border)" }}
              >
                <h3
                  className="text-lg font-semibold mb-4"
                  style={{ color: "var(--color-foreground)" }}
                >
                  How to get your API keys:
                </h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div
                    className="p-4 rounded-lg"
                    style={{
                      backgroundColor: "var(--color-accent)",
                      color: "var(--color-accent-foreground)",
                    }}
                  >
                    <h4 className="font-medium mb-2">Google Gemini API</h4>
                    <ol className="list-decimal list-inside space-y-1 opacity-90">
                      <li>Visit Google AI Studio</li>
                      <li>Sign in with Google account</li>
                      <li>Create new API key</li>
                      <li>Copy the key</li>
                    </ol>
                  </div>
                  <div
                    className="p-4 rounded-lg"
                    style={{
                      backgroundColor: "var(--color-accent)",
                      color: "var(--color-accent-foreground)",
                    }}
                  >
                    <h4 className="font-medium mb-2">ElevenLabs API</h4>
                    <ol className="list-decimal list-inside space-y-1 opacity-90">
                      <li>Visit ElevenLabs website</li>
                      <li>Create free account</li>
                      <li>Go to Profile → API Keys</li>
                      <li>Generate new key</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Upload Step */}
          {currentStep === "upload" && (
            <div className="text-center">
              <h2
                className="text-2xl font-bold mb-4"
                style={{ color: "var(--color-foreground)" }}
              >
                Upload Your PDF
              </h2>
              <p
                className="mb-8"
                style={{ color: "var(--color-muted-foreground)" }}
              >
                Upload a PDF document to extract and transcreate its content
              </p>

              <div
                className={`relative border-2 border-dashed rounded-xl p-12 transition-all duration-200 ${
                  dragActive ? "scale-105" : ""
                } ${isProcessing ? "opacity-50" : "hover:opacity-80"}`}
                style={{
                  borderColor: dragActive
                    ? "var(--color-primary)"
                    : "var(--color-border)",
                  backgroundColor: dragActive
                    ? "var(--color-accent)"
                    : "var(--color-muted)",
                }}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isProcessing}
                />

                <div className="space-y-4">
                  <div className="text-6xl">📄</div>
                  <div>
                    <p
                      className="text-xl font-semibold mb-2"
                      style={{ color: "var(--color-foreground)" }}
                    >
                      {isProcessing ? "Processing..." : "Drop your PDF here"}
                    </p>
                    <p style={{ color: "var(--color-muted-foreground)" }}>
                      {isProcessing
                        ? "Extracting text from your document..."
                        : "or click to browse files"}
                    </p>
                  </div>
                  <div
                    className="text-sm"
                    style={{ color: "var(--color-muted-foreground)" }}
                  >
                    Max file size: 10MB
                  </div>
                </div>

                {isProcessing && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
                      style={{
                        borderColor: "var(--color-primary)",
                        borderTopColor: "transparent",
                      }}
                    ></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Language Selection Step */}
          {currentStep === "language" && (
            <div className="text-center">
              <h2
                className="text-2xl font-bold mb-4"
                style={{ color: "var(--color-foreground)" }}
              >
                Choose Target Language
              </h2>
              <p
                className="mb-8"
                style={{ color: "var(--color-muted-foreground)" }}
              >
                Select the language for transcreation
              </p>

              {pdfInfo && (
                <div
                  className="mb-6 p-4 rounded-lg border text-sm"
                  style={{
                    backgroundColor: "var(--color-accent)",
                    color: "var(--color-accent-foreground)",
                    borderColor: "var(--color-border)",
                  }}
                >
                  <div className="flex justify-center items-center space-x-4">
                    <span>
                      📄 Extracted {pdfInfo.extractedLength.toLocaleString()}{" "}
                      characters from {pdfInfo.extractedPages} pages
                    </span>
                    <span
                      className="h-4 w-px"
                      style={{
                        backgroundColor: "var(--color-accent-foreground)",
                      }}
                    />
                    <span>
                      <strong>~{estimatedTokens.toLocaleString()}</strong>{" "}
                      Gemini tokens estimated
                    </span>
                  </div>
                </div>
              )}

              {pdfInfo?.wasTruncated && (
                <div
                  className="mb-8 p-4 rounded-lg border text-sm text-center"
                  style={{
                    backgroundColor: "oklch(0.8 0.1 80)",
                    color: "oklch(0.2 0.1 80)",
                    borderColor: "oklch(0.6 0.1 80)",
                  }}
                >
                  <p>
                    <strong>Heads up!</strong> Your document was quite long. To
                    save your API credits, we've processed only the beginning of
                    it.
                  </p>
                  <p>
                    (Original: {pdfInfo.originalLength.toLocaleString()} chars →
                    Processed: {pdfInfo.extractedLength.toLocaleString()} chars)
                  </p>
                </div>
              )}

              <div className="grid md:grid-cols-3 gap-4 mb-8">
                {languages.map((language) => (
                  <button
                    key={language.code}
                    onClick={() => handleLanguageSelect(language)}
                    className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                      selectedLanguage?.code === language.code
                        ? "ring-2 shadow-lg scale-105"
                        : "hover:scale-105"
                    }`}
                    style={{
                      borderColor:
                        selectedLanguage?.code === language.code
                          ? "var(--color-primary)"
                          : "var(--color-border)",
                      backgroundColor:
                        selectedLanguage?.code === language.code
                          ? "var(--color-primary)"
                          : "var(--color-secondary)",
                      color:
                        selectedLanguage?.code === language.code
                          ? "var(--color-primary-foreground)"
                          : "var(--color-foreground)",
                    }}
                  >
                    <div className="text-2xl mb-2">🌍</div>
                    <h3 className="font-semibold">{language.name}</h3>
                    <p className="text-sm opacity-80">{language.nativeName}</p>
                  </button>
                ))}
              </div>

              <button
                onClick={handleTranscreate}
                disabled={!selectedLanguage || isProcessing}
                className={`px-8 py-3 rounded-lg font-medium transition-all duration-200 ${
                  selectedLanguage && !isProcessing
                    ? "hover:opacity-90 shadow-lg"
                    : "opacity-50 cursor-not-allowed"
                }`}
                style={{
                  backgroundColor:
                    selectedLanguage && !isProcessing
                      ? "var(--color-primary)"
                      : "var(--color-muted)",
                  color:
                    selectedLanguage && !isProcessing
                      ? "var(--color-primary-foreground)"
                      : "var(--color-muted-foreground)",
                }}
              >
                {isProcessing ? (
                  <span className="flex items-center">
                    <div
                      className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin mr-2"
                      style={{
                        borderColor: "var(--color-primary-foreground)",
                        borderTopColor: "transparent",
                      }}
                    ></div>
                    Transcreating...
                  </span>
                ) : (
                  "Start Transcreation"
                )}
              </button>
            </div>
          )}

          {/* Results Step */}
          {currentStep === "results" && (
            <div>
              <div className="text-center mb-8">
                <h2
                  className="text-2xl font-bold mb-2"
                  style={{ color: "var(--color-foreground)" }}
                >
                  Transcreation Complete!
                </h2>
                <p
                  className="mb-4"
                  style={{ color: "var(--color-muted-foreground)" }}
                >
                  Content successfully transcreated to {selectedLanguage?.name}
                </p>
                <div
                  className="inline-block px-3 py-1 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: "var(--color-accent)",
                    color: "var(--color-accent-foreground)",
                  }}
                >
                  <strong>{geminiTokensUsed.toLocaleString()}</strong> Gemini
                  Tokens Used
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Original Text */}
                <div>
                  <h3
                    className="text-lg font-semibold mb-3 text-center"
                    style={{ color: "var(--color-foreground)" }}
                  >
                    Original Text
                  </h3>
                  <div
                    className="p-4 rounded-lg text-sm h-80 overflow-y-auto border"
                    style={{
                      backgroundColor: "var(--color-muted)",
                      color: "var(--color-muted-foreground)",
                      borderColor: "var(--color-border)",
                    }}
                  >
                    {extractedText}
                  </div>
                </div>

                {/* Transcreated Text */}
                <div>
                  <h3
                    className="text-lg font-semibold mb-3 text-center"
                    style={{ color: "var(--color-foreground)" }}
                  >
                    Transcreated to {selectedLanguage?.name}
                  </h3>
                  <div
                    className="p-4 rounded-lg text-sm h-80 overflow-y-auto border"
                    style={{
                      backgroundColor: "var(--color-secondary)",
                      color: "var(--color-secondary-foreground)",
                      borderColor: "var(--color-border)",
                    }}
                  >
                    {transcreatedText}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col items-center">
                <div className="mb-4 text-center">
                  <p
                    className="text-sm font-medium"
                    style={{ color: "var(--color-foreground)" }}
                  >
                    Ready to generate audio?
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--color-muted-foreground)" }}
                  >
                    This will process{" "}
                    <strong>{transcreatedText.length.toLocaleString()}</strong>{" "}
                    characters using your ElevenLabs API key.
                  </p>
                </div>

                {!canGenerateAudio ? (
                  <div className="w-full max-w-md space-y-4 text-center">
                    <label
                      className="block text-sm font-medium"
                      style={{ color: "var(--color-foreground)" }}
                    >
                      Enter your ElevenLabs API Key to proceed
                    </label>
                    <input
                      type="password"
                      value={elevenlabsApiKey}
                      onChange={(e) => setElevenlabsApiKey(e.target.value)}
                      placeholder="Enter your ElevenLabs API key"
                      className="w-full px-4 py-3 rounded-lg border transition-all duration-200 text-center"
                      style={{
                        backgroundColor: "var(--color-input)",
                        borderColor: "var(--color-border)",
                        color: "var(--color-foreground)",
                      }}
                    />
                    <button
                      onClick={handleGenerateAudio}
                      disabled={!canGenerateAudio || isProcessing}
                      className={`w-full px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                        canGenerateAudio && !isProcessing
                          ? "hover:opacity-90 shadow-lg"
                          : "opacity-50 cursor-not-allowed"
                      }`}
                      style={{
                        backgroundColor:
                          canGenerateAudio && !isProcessing
                            ? "var(--color-primary)"
                            : "var(--color-muted)",
                        color:
                          canGenerateAudio && !isProcessing
                            ? "var(--color-primary-foreground)"
                            : "var(--color-muted-foreground)",
                      }}
                    >
                      {isProcessing ? (
                        <span className="flex items-center justify-center">
                          <div
                            className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin mr-2"
                            style={{
                              borderColor: "var(--color-primary-foreground)",
                              borderTopColor: "transparent",
                            }}
                          ></div>
                          Generating Audio...
                        </span>
                      ) : (
                        "🎵 Save Key & Generate Audio"
                      )}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleGenerateAudio}
                    disabled={isProcessing}
                    className="px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:opacity-90 shadow-lg"
                    style={{
                      backgroundColor: "var(--color-primary)",
                      color: "var(--color-primary-foreground)",
                    }}
                  >
                    {isProcessing ? (
                      <span className="flex items-center">
                        <div
                          className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin mr-2"
                          style={{
                            borderColor: "var(--color-primary-foreground)",
                            borderTopColor: "transparent",
                          }}
                        ></div>
                        Generating Audio...
                      </span>
                    ) : (
                      "🎵 Generate Audio"
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Audio Step */}
          {currentStep === "audio" && (
            <div className="text-center">
              <h2
                className="text-2xl font-bold mb-4"
                style={{ color: "var(--color-foreground)" }}
              >
                Audio Generated! 🎉
              </h2>
              <p
                className="mb-8"
                style={{ color: "var(--color-muted-foreground)" }}
              >
                Your transcreated content has been converted to audio.
              </p>

              <div
                className="inline-block mb-8 px-3 py-1 rounded-full text-sm font-medium"
                style={{
                  backgroundColor: "var(--color-accent)",
                  color: "var(--color-accent-foreground)",
                }}
              >
                <strong>{elevenlabsCharsUsed.toLocaleString()}</strong>{" "}
                ElevenLabs Characters Processed
              </div>

              <div
                className="mb-8 p-6 rounded-xl"
                style={{
                  backgroundColor: "var(--color-accent)",
                  color: "var(--color-accent-foreground)",
                }}
              >
                <div className="text-4xl mb-4">🎵</div>
                <h3 className="text-lg font-semibold mb-4">
                  Audio in {selectedLanguage?.name}
                </h3>
                <audio
                  controls
                  className="w-full"
                  src={audioUrl}
                  style={{
                    backgroundColor: "var(--color-background)",
                    borderRadius: "8px",
                  }}
                >
                  Your browser does not support the audio element.
                </audio>
              </div>

              <div className="space-y-4">
                <button
                  onClick={resetApp}
                  className="px-8 py-3 rounded-lg font-medium transition-all duration-200 hover:opacity-90 shadow-lg"
                  style={{
                    backgroundColor: "var(--color-primary)",
                    color: "var(--color-primary-foreground)",
                  }}
                >
                  Process Another Document
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
