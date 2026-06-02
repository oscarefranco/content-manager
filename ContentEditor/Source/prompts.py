"""Prompt templates for generating instructional design training content.

Each function returns a system prompt and user prompt pair designed to
generate a specific unit of training content following ID principles:
- Bloom's taxonomy learning objectives
- Concept-first approach (what/why before how)
- Procedural clarity with numbered steps
- Active recall via knowledge checks
- Scaffolding from foundational to advanced
"""


def _format_source_content(title: str, description: str, raw_text: str) -> str:
    """Format extracted content for inclusion in prompts."""
    parts = [f"# Source Material\n\n**Title:** {title}"]
    if description:
        parts.append(f"**Description:** {description}")
    parts.append(f"\n**Content:**\n{raw_text[:24000]}")
    return "\n".join(parts)


SYSTEM_PROMPT = """You are an expert instructional designer who creates professional \
training content following Microsoft Learn module conventions. You produce clear, \
well-structured markdown content that follows instructional design best practices:

- Use Bloom's taxonomy action verbs for learning objectives
- Apply scaffolding: build from foundational to advanced concepts
- Use clear, concise language appropriate for a professional audience
- Include real-world context and practical examples
- Format output as clean, well-structured markdown

Always output ONLY the markdown content, with no preamble or explanation."""


def overview_prompt(title: str, description: str, raw_text: str) -> tuple[str, str]:
    """Generate prompt for the module overview (0-overview.md)."""
    source = _format_source_content(title, description, raw_text)
    user_prompt = f"""{source}

---

Based on the source material above, generate a **Module Overview** page in markdown with:

1. **Module Title** — as an H1 heading
2. **Overview paragraph** — 2-3 sentences describing what this module covers and why it matters
3. **Learning Objectives** — a bulleted list starting with "In this module, you'll learn to:" using Bloom's taxonomy verbs (describe, explain, identify, implement, configure, evaluate, etc.)
4. **Prerequisites** — what learners should know or have before starting
5. **Estimated Time** — reasonable estimate based on content depth (e.g., "30 minutes")

Keep it concise and professional."""
    return SYSTEM_PROMPT, user_prompt


def introduction_prompt(title: str, description: str, raw_text: str) -> tuple[str, str]:
    """Generate prompt for the introduction unit (1-introduction.md)."""
    source = _format_source_content(title, description, raw_text)
    user_prompt = f"""{source}

---

Based on the source material above, generate an **Introduction** unit in markdown with:

1. **H1 title**: "Introduction to [topic]"
2. **Context setting** — why this topic matters, the problem it solves, or the scenario it addresses (2-3 paragraphs)
3. **Scope** — what this module covers and what it does not
4. **Key terminology** — define 3-5 key terms that will appear throughout the module in a brief glossary format
5. **What's next** — a brief sentence transitioning to the concepts unit

Use engaging, professional language. Ground the content in real-world use cases."""
    return SYSTEM_PROMPT, user_prompt


def identify_areas_prompt(title: str, description: str, raw_text: str) -> tuple[str, str]:
    """Generate prompt to identify logical areas from the source content."""
    source = _format_source_content(title, description, raw_text)
    system = (
        "You are an expert instructional designer. Analyze source material and "
        "identify its logical topic areas. Respond ONLY with a JSON array — no "
        "markdown fences, no explanation."
    )
    user_prompt = f"""{source}

---

Analyze the source material above and identify **2 to 6 logical topic areas** that the \
content naturally divides into. Each area should be a coherent subtopic that deserves its \
own concepts-and-procedures section.

Return a JSON array of objects with these keys:
- "name": a short, descriptive area title (e.g., "VM Sizing and Performance")
- "slug": a lowercase-hyphenated identifier (e.g., "vm-sizing-and-performance")
- "description": a one-sentence summary of what this area covers

Example output:
[
  {{"name": "VM Sizing and Performance", "slug": "vm-sizing-and-performance", "description": "Covers how to choose and configure VM sizes for workload requirements."}},
  {{"name": "Networking", "slug": "networking", "description": "Explains virtual network setup, NSGs, and connectivity options."}}
]

Return ONLY the JSON array, nothing else."""
    return system, user_prompt


def area_content_prompt(
    title: str,
    description: str,
    raw_text: str,
    area_name: str,
    area_description: str,
) -> tuple[str, str]:
    """Generate prompt for a combined concepts + procedures file for one logical area."""
    source = _format_source_content(title, description, raw_text)
    user_prompt = f"""{source}

---

Based on the source material above, generate a training unit for the topic area \
**"{area_name}"** ({area_description}).

Structure the markdown as follows:

1. **H1 title**: "{area_name}"
2. **Concepts section** (H2: "Key Concepts"):
   - For each concept relevant to this area (2-4 concepts):
     - **H3 heading** with the concept name
     - **Explanation** — what it is and why it matters (concept-first: what/why before how)
     - **Example or analogy** — concrete illustration or real-world comparison
     - **Key takeaway** — one-sentence summary in bold
3. **Procedures section** (H2: "Step-by-Step Procedures"):
   - For each procedure relevant to this area (1-3 procedures):
     - **H3 heading** describing the task
     - **Numbered steps** — clear, actionable instructions
     - **Expected result** — what the learner should see/achieve
     - **Tip or Note** — helpful guidance as a blockquote (> **Tip:** ...)
4. **Troubleshooting** (H2) — brief section with common issues and solutions for this area

Focus ONLY on content relevant to "{area_name}". Do not cover other topic areas. \
Use clear headings, short paragraphs, and bullet points. Use imperative voice for steps."""
    return SYSTEM_PROMPT, user_prompt


def knowledge_check_prompt(title: str, description: str, raw_text: str) -> tuple[str, str]:
    """Generate prompt for the knowledge check (4-knowledge-check.md)."""
    source = _format_source_content(title, description, raw_text)
    user_prompt = f"""{source}

---

Based on the source material above, generate a **Knowledge Check** unit in markdown with:

1. **H1 title**: "Knowledge Check"
2. **3 to 5 multiple-choice questions** that test understanding (not memorization). For each question:
   - **H2**: "Question N" (numbered)
   - The question text in bold
   - Four answer choices labeled A through D
   - An "Answer" section with:
     - **Correct answer** clearly marked
     - **Explanation** — why the correct answer is right and briefly why others are wrong

Questions should cover different Bloom's taxonomy levels:
- At least 1 recall/comprehension question
- At least 1 application/analysis question
- At least 1 evaluation/synthesis question

Mix difficulty levels. Distractors should be plausible but clearly incorrect upon understanding."""
    return SYSTEM_PROMPT, user_prompt


def knowledge_check_yaml_prompt(
    title: str, description: str, raw_text: str, module_uid: str = "learn.module-name.check"
) -> tuple[str, str]:
    """Generate prompt for the knowledge check as a YAML file in MS Learn format."""
    source = _format_source_content(title, description, raw_text)
    system = (
        "You are an expert instructional designer. You produce knowledge check quizzes "
        "in the exact Microsoft Learn YamlMime:ModuleUnit YAML format. Output ONLY the "
        "raw YAML content — no markdown fences, no explanation, no preamble."
    )
    user_prompt = f"""{source}

---

Based on the source material above, generate a **Knowledge Check** in the Microsoft Learn \
YamlMime:ModuleUnit YAML format.

Output MUST follow this exact structure:

### YamlMime:ModuleUnit
uid: {module_uid}
title: Check your knowledge
metadata:
  title: Check your knowledge
  description: Answer the following questions to see what you learned.
  ms.date: 01/29/2026
  author: AuthorName
  ms.author: authoralias
  ms.topic: unit
durationInMinutes: 6
quiz:
  title: Answer the following questions to see what you learned.
  questions:
  - content: <question text here>
    choices:
    - content: <choice text>
      isCorrect: false
      explanation: <explanation text>
    - content: <choice text>
      isCorrect: true
      explanation: <explanation text>
    - content: <choice text>
      isCorrect: false
      explanation: <explanation text>
    - content: <choice text>
      isCorrect: false
      explanation: <explanation text>

Rules:
- Generate **3 to 5 questions** that test understanding, not memorization.
- Each question MUST have exactly **4 choices**.
- Exactly **one** choice per question must have `isCorrect: true`.
- Every choice MUST have an `explanation` field.
- Explanations should explain why the answer is correct or incorrect.
- Cover different Bloom's taxonomy levels (recall, application, evaluation).
- Distractors should be plausible but clearly incorrect upon understanding.
- Output ONLY the YAML content starting with `### YamlMime:ModuleUnit`. No markdown fences."""
    return system, user_prompt


def summary_prompt(title: str, description: str, raw_text: str) -> tuple[str, str]:
    """Generate prompt for the summary unit (5-summary.md)."""
    source = _format_source_content(title, description, raw_text)
    user_prompt = f"""{source}

---

Based on the source material above, generate a **Summary** unit in markdown with:

1. **H1 title**: "Summary"
2. **Recap paragraph** — 2-3 sentences summarizing what was covered in this module
3. **Key takeaways** — bulleted list of 4-6 most important points
4. **Next steps** — what the learner should do next or explore further
5. **Additional resources** — 3-5 links or references for further learning (use the source URL and any related links found in the material)

Keep it concise. The summary should reinforce the learning objectives stated in the overview."""
    return SYSTEM_PROMPT, user_prompt


# Static units that are always generated (one per module).
# Area-based units are generated dynamically — see generate_training.py.
STATIC_UNIT_PROMPTS = {
    "overview": overview_prompt,
    "introduction": introduction_prompt,
    "knowledge-check": knowledge_check_prompt,
    "summary": summary_prompt,
}

# YAML-based knowledge check prompt (used by the UI)
YAML_UNIT_PROMPTS = {
    "knowledge-check": knowledge_check_yaml_prompt,
}


def unit_yaml_metadata_prompt(
    unit_markdown: str,
    module_slug: str,
    unit_slug: str,
) -> tuple[str, str]:
    """Generate prompt for a companion YAML metadata file for a markdown unit.

    The YAML follows the Microsoft Learn YamlMime:ModuleUnit format.
    """
    system = (
        "You are an expert instructional designer. You generate YAML metadata files "
        "in the exact Microsoft Learn YamlMime:ModuleUnit format. Output ONLY the raw "
        "YAML content — no markdown fences, no explanation, no preamble."
    )
    user_prompt = f"""Below is the markdown content of a training unit:

---
{unit_markdown[:8000]}
---

Generate a companion YAML metadata file for this unit in the Microsoft Learn \
YamlMime:ModuleUnit format. The YAML MUST follow this exact structure:

### YamlMime:ModuleUnit
uid: learn.{module_slug}.{unit_slug}
title: <extracted from the H1 heading of the markdown>
metadata:
  title: <same as above>
  description: <a one-sentence summary of what this unit covers>
  ms.date: <today's date in MM/DD/YYYY format>
  author: AuthorName
  ms.author: authoralias
  ms.topic: unit
durationInMinutes: <estimate based on content length: ~1 min per 200 words>
content: |
  [!include[](includes/{unit_slug}.md)]

Rules:
- Extract the title from the first H1 heading in the markdown.
- Write a concise, accurate description (one sentence).
- Estimate durationInMinutes based on content length (~1 minute per 200 words, minimum 3).
- The uid must be: learn.{module_slug}.{unit_slug}
- The content include path must be: includes/{unit_slug}.md
- Output ONLY the YAML starting with `### YamlMime:ModuleUnit`. No markdown fences."""
    return system, user_prompt
