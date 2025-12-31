# PromptoDYS Editor

**PromptoDYS Editor** is the accessible front-end editor component of the larger **PromptoDYS** ecosystem.

While this editor focuses on providing a dyslexia-friendly writing environment, it is designed to work in tandem with a **Python backend**. This backend leverages **Generative AI** to post-process notes, organize thoughts, and enhance the writing of users with dyslexia.

## ✨ Features

- **OpenDyslexic Font**: Integrated font designed to mitigate some of the common reading errors caused by dyslexia.
- **Customizable Interface**:
    - **Font Size**: Adjustable text size for better visibility.
    - **Line Spacing**: Customizable spacing to prevent line skipping.
    - **Word Spacing**: Adjustable spacing between words.
    - **Themes**: High-contrast modes and specific color palettes (e.g., yellow/blue) to reduce visual stress.
- **Text-to-Speech (TTS)**: Reads the text aloud to assist with comprehension and proofreading.
- **Ruler Guide**: A reading ruler to help focus on the current line.
- **PDF Export**: Save documents as accessible PDFs.
- **Syllable Separation**: (Planned/In-progress) Visual aids to break down words.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- [npm](https://www.npmjs.com/)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/lecinquiemejour-code/PromptoDYS_editor.git
    cd PromptoDYS_editor
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the development server:
    ```bash
    npm start
    ```

The application will open in your default browser at `http://localhost:3000`.

## 🛠️ Built With

- **React**: Frontend library for building the user interface.
- **PostCSS**: For styling and layout.
- **MathJax**: For rendering mathematical content.

## 📄 License

This project is licensed under the **GNU General Public License v3.0** (GPLv3). See the [LICENSE](LICENSE) file for details.

This means you are free to use, modify, and distribute this software, but any changes you distribute must remain open source under the same license.
