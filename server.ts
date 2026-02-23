import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";

dotenv.config({ path: path.resolve(".env.local") });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", env: { 
      hasGemini: !!process.env.GEMINI_API_KEY,
      hasSupabase: !!process.env.VITE_SUPABASE_URL 
    }});
  });

  // Gemini AI Insights Endpoint
  app.post("/api/ai/insights", async (req, res) => {
    try {
      const { transactions, budgets, month, year } = req.body;
      
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key not configured" });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `
        As a senior financial advisor, analyze the following financial data for ${month}/${year}:
        
        Transactions:
        ${JSON.stringify(transactions)}
        
        Budgets:
        ${JSON.stringify(budgets)}
        
        Provide a detailed breakdown of spending, actionable saving tips, identify risk areas, and calculate a financial health score (0-100).
        Return the response in strict JSON format with these exact fields: breakdown (string), saving_tips (array of strings), risk_areas (array of strings), and financial_health_score (number from 0-100).
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          response_mime_type: "application/json",
          response_json_schema: {
            type: "object",
            properties: {
              breakdown: { type: "string", description: "Detailed breakdown of spending patterns" },
              saving_tips: { 
                type: "array",
                items: { type: "string" },
                description: "List of actionable saving tips"
              },
              risk_areas: { 
                type: "array",
                items: { type: "string" },
                description: "Financial areas that need attention"
              },
              financial_health_score: { 
                type: "number",
                description: "Financial health score from 0-100"
              }
            },
            required: ["breakdown", "saving_tips", "risk_areas", "financial_health_score"]
          }
        }
      });

      const insights = JSON.parse(response.text || "{}");
      res.json(insights);
    } catch (error: any) {
      console.error("AI Insights Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate insights" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
