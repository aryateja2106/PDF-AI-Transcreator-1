# 📄 PDF AI Transcreator

[![Next.js](https://img.shields.io/badge/Next.js-15.3-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-blueviolet?logo=tailwind-css)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3-blue?logo=sqlite)](https://www.sqlite.org/)

Transform your research papers and documents into clear, understandable content in multiple languages, complete with natural-sounding audio narration. This application leverages the power of AI to extract, transcreate, and voice your PDFs, all while giving you full control over your API usage.

This project is designed to be run locally, using your own API keys, so you have complete privacy and control over your data and costs.

![App Screenshot](https://i.imgur.com/your-screenshot-url.png) <!-- TODO: Add a real screenshot -->

## ✨ Features

- **Bring Your Own API Keys**: Securely use your own Google Gemini and ElevenLabs API keys.
- **Intelligent Text Extraction**: Extracts text from PDFs, with OCR (Optical Character Recognition) fallback for image-based documents.
- **AI-Powered Transcreation**: Uses Google Gemini to transcreate content into multiple languages (Hindi, Telugu, Spanish, French, Chinese) with a focus on readability and natural language.
- **Text-to-Speech Audio**: Generates high-quality, natural-sounding audio narration of the transcreated content using ElevenLabs.
- **Token Transparency**: Clearly displays estimated and actual API usage (Gemini tokens, ElevenLabs characters) so you always know your consumption.
- **Cost Control**: Automatically truncates very long documents to a safe limit to prevent accidental high costs.
- **Modern, User-Friendly Interface**: A clean, step-by-step wizard guides you through the process.
- **Dark Mode Support**: Beautifully designed UI that respects your system's theme.
- **Local Caching**: Uses a local SQLite database to cache results, saving you time and API credits on subsequent requests for the same document.

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine.

### Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/en/) (v18 or later is recommended)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/your-repo-name.git
    ```
    (Replace `your-username/your-repo-name` with the actual repository URL)

2.  **Navigate to the project directory:**
    ```bash
    cd research-reader
    ```

3.  **Install the dependencies:**
    ```bash
    npm install
    ```

### Configuration: API Keys

This application requires API keys from Google and ElevenLabs. The app will prompt you to enter these in the user interface, so there's no need to create `.env` files.

-   **Google Gemini API Key**:
    1.  Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
    2.  Sign in with your Google account.
    3.  Click "**Create API key**".
    4.  Copy the generated key.

-   **ElevenLabs API Key** (Optional - only for audio generation):
    1.  Go to the [ElevenLabs Website](https://elevenlabs.io/) and create a free account.
    2.  In your profile, find the "**API Key**" section.
    3.  Copy your API key.

### Running the Application

1.  **Start the development server:**
    ```bash
    npm run dev
    ```

2.  **Open your browser:**
    Navigate to [http://localhost:3000](http://localhost:3000). You should see the application running!

## 💡 How to Use

1.  **Setup**: On the first screen, enter your Google Gemini API key. You can also enter your ElevenLabs API key here, or you can add it later.
2.  **Upload**: Drag and drop a PDF file or click to browse and select one. The app will process the file to extract its text.
3.  **Language**: Choose the language you want to transcreate the text into. You'll see an estimate of the tokens required.
4.  **Results**: Review the original and transcreated text side-by-side. You will see the exact number of Gemini tokens that were used.
5.  **Audio**: If you wish to generate audio, you can click the "Generate Audio" button. If you haven't added your ElevenLabs key yet, you'll be prompted to enter it here.
6.  **Listen**: Once generated, an audio player will appear. You can listen to the narrated text and start over with a new document whenever you're ready.

## 🛠️ Technology Stack

-   **Framework**: [Next.js](https://nextjs.org/) (React)
-   **Language**: [TypeScript](https://www.typescriptlang.org/)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
-   **Database**: [SQLite](https://www.sqlite.org/) with [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
-   **AI Services**:
    -   [Google Gemini](https://ai.google.dev/) for transcreation.
    -   [ElevenLabs](https://elevenlabs.io/) for text-to-speech.
-   **PDF Processing**:
    -   [pdfreader](https://www.npmjs.com/package/pdfreader) for text extraction.
    -   [pdf2pic](https://www.npmjs.com/package/pdf2pic) & [node-tesseract-ocr](https://www.npmjs.com/package/node-tesseract-ocr) for OCR fallback.

## 🤝 Contributing

Contributions are welcome! If you have suggestions for improvements or want to fix a bug, please feel free to open an issue or submit a pull request.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.
