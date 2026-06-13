import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API endpoint for Gemini chat proxy
  app.post("/api/chat", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        console.error("Missing Gemini API key in environment variables");
        return res.status(500).json({ error: "Gemini API key is not configured in the server environment. Please define GEMINI_API_KEY." });
      }

      // Initialize the official @google/genai client
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const { message, history, context } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message parameter is required." });
      }

      // Design context aware prompting
      const systemInstruction = `You are Globi, a warm, knowledgeable AI travel concierge. Always reference the user’s actual data when giving advice. Use markdown for structured plans. Keep replies friendly and concrete.
LIVE APP DATA: ${context || 'No active trip or history data is logged yet.'}`;

      const contents: any[] = [];
      // Pass history to maintain conversational context
      if (history && Array.isArray(history)) {
        history.forEach((msg: any) => {
          contents.push({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.text }]
          });
        });
      }

      // Append current user prompt
      contents.push({
        role: "user",
        parts: [{ text: message }]
      });

      // Call Gemini 3.5 Flash as recommended for general text Q&A tasks
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });

      const replyText = response.text || "I was unable to compile a response. Let me try again!";
      res.json({ text: replyText });

    } catch (error: any) {
      console.error("Error calling Gemini API:", error);
      res.status(500).json({ error: error.message || "An error occurred while connecting to Globi." });
    }
  });

  // Serve static dist in production, use Vite in development mode
  if (process.env.NODE_ENV === "production" || process.env.DISABLE_HMR === "true") {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Catch-all route to serve index.html for SPA behavior
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[WanderWise Server] Running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
