// ══════════════════════════════════════════════════════════════════════════
// PROMPT TEMPLATES (ported from prompts.py)
// ══════════════════════════════════════════════════════════════════════════

function formatSourceContent(title, description, rawText) {
  let parts = [`# Source Material\n\n**Title:** ${title}`];
  if (description) parts.push(`**Description:** ${description}`);
  parts.push(`\n**Content:**\n${rawText.substring(0, 24000)}`);
  return parts.join('\n');
}

const ID_SYSTEM_PROMPT = `You are an expert instructional designer who creates professional \
training content following Microsoft Learn module conventions. You produce clear, \
well-structured markdown content that follows instructional design best practices:

- Use Bloom's taxonomy action verbs for learning objectives
- Apply scaffolding: build from foundational to advanced concepts
- Use clear, concise language appropriate for a professional audience
- Include real-world context and practical examples
- Format output as clean, well-structured markdown

Always output ONLY the markdown content, with no preamble or explanation.`;

const MODULE_PROMPTS = {
  overview(title, desc, text) {
    const source = formatSourceContent(title, desc, text);
    return {
      system: ID_SYSTEM_PROMPT,
      user: `${source}\n\n---\n\nBased on the source material above, generate a **Module Overview** page in markdown with:\n\n1. **Module Title** — as an H1 heading\n2. **Overview paragraph** — 2-3 sentences describing what this module covers and why it matters\n3. **Learning Objectives** — a bulleted list starting with "In this module, you'll learn to:" using Bloom's taxonomy verbs (describe, explain, identify, implement, configure, evaluate, etc.)\n4. **Prerequisites** — what learners should know or have before starting\n5. **Estimated Time** — reasonable estimate based on content depth (e.g., "30 minutes")\n\nKeep it concise and professional.`,
    };
  },

  introduction(title, desc, text) {
    const source = formatSourceContent(title, desc, text);
    return {
      system: ID_SYSTEM_PROMPT,
      user: `${source}\n\n---\n\nBased on the source material above, generate an **Introduction** unit in markdown with:\n\n1. **H1 title**: "Introduction to [topic]"\n2. **Context setting** — why this topic matters, the problem it solves, or the scenario it addresses (2-3 paragraphs)\n3. **Scope** — what this module covers and what it does not\n4. **Key terminology** — define 3-5 key terms that will appear throughout the module in a brief glossary format\n5. **What's next** — a brief sentence transitioning to the concepts unit\n\nUse engaging, professional language. Ground the content in real-world use cases.`,
    };
  },

  identifyAreas(title, desc, text) {
    const source = formatSourceContent(title, desc, text);
    return {
      system: 'You are an expert instructional designer. Analyze source material and identify its logical topic areas. Respond ONLY with a JSON array — no markdown fences, no explanation.',
      user: `${source}\n\n---\n\nAnalyze the source material above and identify **2 to 6 logical topic areas** that the content naturally divides into. Each area should be a coherent subtopic that deserves its own concepts-and-procedures section.\n\nReturn a JSON array of objects with these keys:\n- "name": a short, descriptive area title (e.g., "VM Sizing and Performance")\n- "slug": a lowercase-hyphenated identifier (e.g., "vm-sizing-and-performance")\n- "description": a one-sentence summary of what this area covers\n\nExample output:\n[\n  {"name": "VM Sizing and Performance", "slug": "vm-sizing-and-performance", "description": "Covers how to choose and configure VM sizes for workload requirements."},\n  {"name": "Networking", "slug": "networking", "description": "Explains virtual network setup, NSGs, and connectivity options."}\n]\n\nReturn ONLY the JSON array, nothing else.`,
    };
  },

  areaContent(title, desc, text, areaName, areaDesc) {
    const source = formatSourceContent(title, desc, text);
    return {
      system: ID_SYSTEM_PROMPT,
      user: `${source}\n\n---\n\nBased on the source material above, generate a training unit for the topic area **"${areaName}"** (${areaDesc}).\n\nStructure the markdown as follows:\n\n1. **H1 title**: "${areaName}"\n2. **Concepts section** (H2: "Key Concepts"):\n   - For each concept relevant to this area (2-4 concepts):\n     - **H3 heading** with the concept name\n     - **Explanation** — what it is and why it matters (concept-first: what/why before how)\n     - **Example or analogy** — concrete illustration or real-world comparison\n     - **Key takeaway** — one-sentence summary in bold\n3. **Procedures section** (H2: "Step-by-Step Procedures"):\n   - For each procedure relevant to this area (1-3 procedures):\n     - **H3 heading** describing the task\n     - **Numbered steps** — clear, actionable instructions\n     - **Expected result** — what the learner should see/achieve\n     - **Tip or Note** — helpful guidance as a blockquote (> **Tip:** ...)\n4. **Troubleshooting** (H2) — brief section with common issues and solutions for this area\n\nFocus ONLY on content relevant to "${areaName}". Do not cover other topic areas. Use clear headings, short paragraphs, and bullet points. Use imperative voice for steps.`,
    };
  },

  knowledgeCheck(title, desc, text) {
    const source = formatSourceContent(title, desc, text);
    return {
      system: ID_SYSTEM_PROMPT,
      user: `${source}\n\n---\n\nBased on the source material above, generate a **Knowledge Check** unit in markdown with:\n\n1. **H1 title**: "Knowledge Check"\n2. **3 to 5 multiple-choice questions** that test understanding (not memorization). For each question:\n   - **H2**: "Question N" (numbered)\n   - The question text in bold\n   - Four answer choices labeled A through D\n   - An "Answer" section with:\n     - **Correct answer** clearly marked\n     - **Explanation** — why the correct answer is right and briefly why others are wrong\n\nQuestions should cover different Bloom's taxonomy levels:\n- At least 1 recall/comprehension question\n- At least 1 application/analysis question\n- At least 1 evaluation/synthesis question\n\nMix difficulty levels. Distractors should be plausible but clearly incorrect upon understanding.`,
    };
  },

  summary(title, desc, text) {
    const source = formatSourceContent(title, desc, text);
    return {
      system: ID_SYSTEM_PROMPT,
      user: `${source}\n\n---\n\nBased on the source material above, generate a **Summary** unit in markdown with:\n\n1. **H1 title**: "Summary"\n2. **Recap paragraph** — 2-3 sentences summarizing what was covered in this module\n3. **Key takeaways** — bulleted list of 4-6 most important points\n4. **Next steps** — what the learner should do next or explore further\n5. **Additional resources** — 3-5 links or references for further learning (use the source URL and any related links found in the material)\n\nKeep it concise. The summary should reinforce the learning objectives stated in the overview.`,
    };
  },
};

function parseAreasResponse(raw) {
  const cleaned = raw.replace(/```(?:json)?\s*/g, '').trim().replace(/`+$/, '');
  let areas;
  try { areas = JSON.parse(cleaned); } catch (e) {
    throw new Error(`Failed to parse areas JSON: ${e.message}`);
  }
  if (!Array.isArray(areas) || areas.length === 0) throw new Error('Expected a non-empty JSON array of areas');
  return areas.map((a, i) => ({
    name: (a.name || '').trim() || `Area ${i + 1}`,
    slug: (a.slug || '').trim() || a.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    description: (a.description || '').trim(),
  }));
}

