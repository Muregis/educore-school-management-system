#!/usr/bin/env node
import fs from "fs";

const path = "backend/src/routes/analysis.routes.js";
let t = fs.readFileSync(path, "utf8");

const old = `    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": \`Bearer \${apiKey}\`,
      },
      body: JSON.stringify({
        model:       "llama-3.1-8b-instant",
        max_tokens:  1800,
        temperature: 0.4,
        messages:    [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("[ai-report] Groq error:", data);
      return res.status(response.status).json(data);
    }

    const text = data.choices?.[0]?.message?.content || "";
    res.json({ text });`;

// Without escaped backticks - match file as written
const needle = 'model:       "llama-3.1-8b-instant"';
if (!t.includes(needle)) {
  console.error("model string not found");
  process.exit(1);
}

const start = t.indexOf('    const response = await fetch("https://api.groq.com/openai/v1/chat/completions"');
const end = t.indexOf('    const text = data.choices?.[0]?.message?.content || "";\n    res.json({ text });');
if (start < 0 || end < 0) {
  console.error("block bounds", start, end);
  process.exit(1);
}
const end2 = end + '    const text = data.choices?.[0]?.message?.content || "";\n    res.json({ text });'.length;

const replacement = `    // Prefer self-serve models (llama-3.1-8b-instant is enterprise-only on many keys)
    const modelCandidates = [
      process.env.GROQ_MODEL,
      "openai/gpt-oss-20b",
      "openai/gpt-oss-120b",
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
    ].filter(Boolean);

    let data = null;
    let lastStatus = 500;
    let lastError = null;
    for (const model of modelCandidates) {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: \`Bearer \${apiKey}\`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 1800,
          temperature: 0.4,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      lastStatus = response.status;
      data = await response.json();
      if (response.ok) break;
      lastError = data;
      console.error("[ai-report] Groq error model=", model, data);
      const code = data?.error?.code || data?.code;
      if (code !== "model_not_found" && response.status !== 404) break;
    }

    if (!data?.choices?.[0]?.message?.content) {
      const msg =
        lastError?.error?.message ||
        lastError?.message ||
        "AI provider failed";
      return res.status(lastStatus >= 400 ? lastStatus : 502).json({
        error: msg,
        message: msg,
        details: lastError,
      });
    }

    const text = data.choices[0].message.content;
    res.json({ text });`;

t = t.slice(0, start) + replacement + t.slice(end2);
fs.writeFileSync(path, t);
console.log("OK", t.includes("openai/gpt-oss-20b"));
