// ══════════════════════════════════════════════════════════════════════════
// CONTENT GENERATION FOR GAP-DRIVEN SUGGESTIONS
// ══════════════════════════════════════════════════════════════════════════

async function generateContentForSuggestion(globalIdx) {
  const suggestion = state.editorSuggestions[globalIdx];
  if (!suggestion) {
    console.error('Suggestion not found:', globalIdx);
    toast('Suggestion not found', 'error');
    return;
  }

  console.log('Generating content for suggestion:', suggestion);

  // Mark as generating
  suggestion.status = 'generating';
  renderEditorView();

  try {
    // Route to appropriate generator based on action type
    if (suggestion.actionType === ACTION_TYPES.EDIT_EXISTING) {
      await generateEditContent(suggestion);
    } else if (suggestion.actionType === ACTION_TYPES.ADD_TO_UNIT) {
      await generateAddContent(suggestion);
    } else if (suggestion.actionType === ACTION_TYPES.NEW_UNIT) {
      await generateNewUnitContent(suggestion);
    } else if (suggestion.actionType === ACTION_TYPES.NEW_MODULE) {
      // For NEW_MODULE, use the existing full module generator
      const source = buildSourceFromGapSuggestion(suggestion);
      console.log('Built source:', source);
      await generateFullModule(source);
      suggestion.generatedContent = editorState.generatedModule;
    }
    
    // Mark as generated
    suggestion.status = 'generated';
    
    toast(`Content generated for: ${suggestion.gap.docTopic.title}`, 'success');
    
  } catch (err) {
    console.error('Generation failed:', err);
    suggestion.status = 'pending';
    toast(`Generation failed: ${err.message}`, 'error');
  }
  
  renderEditorView();
}

async function generateEditContent(suggestion) {
  const gap = suggestion.gap;
  const docTopic = gap.docTopic;
  const productName = state.selectedProduct?.name || 'Unknown Product';
  
  toast('Fetching existing unit content...', 'info');
  
  // Try to find the module and unit
  const targetModuleName = suggestion.targetModule;
  const targetUnitName = suggestion.targetUnit;
  
  // Search for the module in our modules list
  const module = state.modules.find(m => 
    m.title === targetModuleName || 
    m.title.includes(targetModuleName) ||
    targetModuleName.includes(m.title)
  );
  
  if (!module) {
    throw new Error(`Could not find module: ${targetModuleName}`);
  }
  
  console.log('Found module:', module);
  
  // Fetch current unit content from GitHub
  let currentContent = '';
  let unitPath = '';
  
  try {
    // Try to find unit file in the module's directory
    const modulePath = module.path.replace('/index.yml', '');
    const unitSlug = targetUnitName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // Common unit file patterns
    const possiblePaths = [
      `${modulePath}/${unitSlug}.yml`,
      `${modulePath}/${unitSlug}.md`,
      `${modulePath}/includes/${unitSlug}.md`,
    ];
    
    for (const path of possiblePaths) {
      try {
        const url = `https://api.github.com/repos/MicrosoftDocs/${module.repo}/contents/${path}?ref=${state.repoBranches[module.repo]}`;
        const response = await fetch(url, { headers: ghHeaders() });
        
        if (response.ok) {
          const data = await response.json();
          currentContent = atob(data.content);
          unitPath = path;
          console.log(`Found unit content at: ${unitPath}`);
          break;
        }
      } catch (err) {
        // Try next path
        continue;
      }
    }
    
    if (!currentContent) {
      throw new Error(`Could not fetch unit content for: ${targetUnitName}`);
    }
    
  } catch (err) {
    console.error('Failed to fetch unit content:', err);
    throw new Error(`Failed to fetch existing unit content: ${err.message}`);
  }
  
  toast('Generating edits with AI...', 'info');
  
  // Call AI to generate the edits
  const { token, model } = getAIConfig();
  
  const prompt = `You are a technical content editor for Microsoft Learn training materials.

TASK: Generate edits to improve existing training content to cover a documentation gap.

EXISTING UNIT CONTENT:
\`\`\`
${currentContent.substring(0, 8000)}
\`\`\`

DOCUMENTATION GAP:
Topic: ${docTopic.title}
Path: ${docTopic.path}
Explanation: ${gap.explanation}

TARGET MODULE: ${targetModuleName}
TARGET UNIT: ${targetUnitName}
PRODUCT: ${productName}

AI RECOMMENDATION:
${suggestion.reasoning}

INSTRUCTIONS:
1. Review the existing unit content above
2. Identify WHERE in the content the gap should be addressed
3. Generate ONLY the new/modified sections needed to cover the gap
4. Format as markdown with clear section headings
5. Include practical examples and clear explanations
6. Match the tone and style of the existing content

OUTPUT FORMAT (JSON):
{
  "insertionPoint": "after-introduction|middle|before-summary",
  "newContent": "markdown content to insert or replace",
  "explanation": "brief explanation of where and why these edits improve coverage"
}`;

  const response = await fetch('https://models.github.ai/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4000
    })
  });
  
  if (!response.ok) {
    throw new Error(`AI API error: ${response.statusText}`);
  }
  
  const result = await response.json();
  const aiContent = result.choices[0].message.content;
  
  // Parse JSON response
  let editData;
  try {
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      editData = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in response');
    }
  } catch (err) {
    console.warn('Failed to parse JSON, using raw content');
    editData = {
      insertionPoint: 'middle',
      newContent: aiContent,
      explanation: 'Generated edit content (JSON parsing failed)'
    };
  }
  
  // Store the edit in suggestion
  suggestion.generatedContent = {
    type: 'edit',
    unitPath: unitPath,
    originalContent: currentContent,
    newContent: editData.newContent,
    insertionPoint: editData.insertionPoint,
    explanation: editData.explanation,
    preview: generateEditPreview(currentContent, editData)
  };
  
  console.log('Edit content generated:', suggestion.generatedContent);
}

function generateEditPreview(originalContent, editData) {
  // Generate a preview showing original with highlights
  const lines = originalContent.split('\n');
  const insertionPoint = editData.insertionPoint;
  
  let previewHtml = '<div style="font-family:monospace;font-size:11px;line-height:1.6;max-height:600px;overflow-y:auto;">';
  
  // Show first 10 lines
  previewHtml += '<div style="color:var(--text-muted);">';
  previewHtml += escHtml(lines.slice(0, 10).join('\n'));
  previewHtml += '\n...</div>';
  
  // Show insertion point
  previewHtml += '<div style="background:#fff3cd;padding:8px;margin:8px 0;border-left:3px solid #ffc107;">';
  previewHtml += '<strong>📝 New content will be inserted here:</strong><br><br>';
  previewHtml += escHtml(editData.newContent.substring(0, 500));
  if (editData.newContent.length > 500) previewHtml += '\n...';
  previewHtml += '</div>';
  
  // Show last 5 lines
  previewHtml += '<div style="color:var(--text-muted);">...';
  previewHtml += escHtml(lines.slice(-5).join('\n'));
  previewHtml += '</div>';
  
  previewHtml += '</div>';
  
  return previewHtml;
}

async function generateAddContent(suggestion) {
  const gap = suggestion.gap;
  const docTopic = gap.docTopic;
  const productName = state.selectedProduct?.name || 'Unknown Product';
  
  toast('Generating new section to add...', 'info');
  
  // Find the target module and unit
  const targetModuleName = suggestion.targetModule;
  const targetUnitName = suggestion.targetUnit;
  
  const module = state.modules.find(m => 
    m.title === targetModuleName || 
    m.title.includes(targetModuleName) ||
    targetModuleName.includes(m.title)
  );
  
  if (!module) {
    throw new Error(`Could not find module: ${targetModuleName}`);
  }
  
  // Fetch current unit for context
  let currentContent = '';
  try {
    const modulePath = module.path.replace('/index.yml', '');
    const unitSlug = targetUnitName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const possiblePaths = [
      `${modulePath}/${unitSlug}.yml`,
      `${modulePath}/${unitSlug}.md`,
      `${modulePath}/includes/${unitSlug}.md`,
    ];
    
    for (const path of possiblePaths) {
      try {
        const url = `https://api.github.com/repos/MicrosoftDocs/${module.repo}/contents/${path}?ref=${state.repoBranches[module.repo]}`;
        const response = await fetch(url, { headers: ghHeaders() });
        if (response.ok) {
          const data = await response.json();
          currentContent = atob(data.content);
          break;
        }
      } catch (err) {
        continue;
      }
    }
  } catch (err) {
    console.warn('Could not fetch unit content, proceeding without context');
  }
  
  // Call AI to generate new section
  const { token, model } = getAIConfig();
  
  const prompt = `You are a technical content writer for Microsoft Learn training materials.

TASK: Generate a NEW SECTION to add to an existing training unit to cover a documentation gap.

${currentContent ? `EXISTING UNIT CONTENT (for context):
\`\`\`
${currentContent.substring(0, 6000)}
\`\`\`

` : ''}TARGET MODULE: ${targetModuleName}
TARGET UNIT: ${targetUnitName}
PRODUCT: ${productName}

DOCUMENTATION GAP:
Topic: ${docTopic.title}
Path: ${docTopic.path}
Explanation: ${gap.explanation}

AI RECOMMENDATION:
${suggestion.reasoning}

INSTRUCTIONS:
1. Generate a NEW SECTION (not a full unit) to append to the existing unit
2. Include a clear heading (## or ###)
3. Provide practical content with examples
4. Match the tone and style of Microsoft Learn training
5. Keep it focused and concise (300-800 words)
6. Include code examples if relevant

OUTPUT FORMAT (JSON):
{
  "sectionTitle": "clear section heading",
  "content": "full markdown content for the new section",
  "insertionPoint": "end|after-introduction",
  "summary": "brief explanation of what this section adds"
}`;

  const response = await fetch('https://models.github.ai/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 3000
    })
  });
  
  if (!response.ok) {
    throw new Error(`AI API error: ${response.statusText}`);
  }
  
  const result = await response.json();
  const aiContent = result.choices[0].message.content;
  
  // Parse JSON response
  let sectionData;
  try {
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      sectionData = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found');
    }
  } catch (err) {
    console.warn('Failed to parse JSON, using raw content');
    sectionData = {
      sectionTitle: docTopic.title,
      content: aiContent,
      insertionPoint: 'end',
      summary: 'New section content'
    };
  }
  
  // Store the generated section
  suggestion.generatedContent = {
    type: 'add_section',
    sectionTitle: sectionData.sectionTitle,
    content: sectionData.content,
    insertionPoint: sectionData.insertionPoint,
    summary: sectionData.summary
  };
  
  console.log('Add content generated:', suggestion.generatedContent);
}

async function generateNewUnitContent(suggestion) {
  const gap = suggestion.gap;
  const docTopic = gap.docTopic;
  const productName = state.selectedProduct?.name || 'Unknown Product';
  
  toast('Generating complete new unit...', 'info');
  
  // Find the target module
  const targetModuleName = suggestion.targetModule;
  
  const module = state.modules.find(m => 
    m.title === targetModuleName || 
    m.title.includes(targetModuleName) ||
    targetModuleName.includes(m.title)
  );
  
  if (!module) {
    throw new Error(`Could not find module: ${targetModuleName}`);
  }
  
  // Get existing units for context
  const existingUnits = module.units || [];
  const unitsContext = existingUnits.length > 0 
    ? `\n\nExisting units in this module:\n${existingUnits.map((u, i) => `${i+1}. ${u}`).join('\n')}`
    : '';
  
  // Call AI to generate complete unit
  const { token, model } = getAIConfig();
  
  const prompt = `You are a technical content writer for Microsoft Learn training materials.

TASK: Generate a COMPLETE NEW UNIT for an existing training module to cover a documentation gap.

TARGET MODULE: ${targetModuleName}
MODULE SUMMARY: ${module.summary || 'N/A'}${unitsContext}

PRODUCT: ${productName}

DOCUMENTATION GAP:
Topic: ${docTopic.title}
Path: ${docTopic.path}
Explanation: ${gap.explanation}

AI RECOMMENDATION:
${suggestion.reasoning}

INSTRUCTIONS:
1. Generate a COMPLETE training unit following Microsoft Learn structure
2. Include YAML frontmatter with: title, description, ms.date (today), ms.author
3. Include these markdown sections:
   - ## Introduction (hook + learning objectives)
   - ## Main content sections (2-3 sections covering the topic)
   - ## Knowledge check (3-5 multiple choice questions)
   - ## Summary (recap + next steps)
4. Use practical examples and clear explanations
5. Keep total length 800-1500 words
6. Match Microsoft Learn tone and style

OUTPUT FORMAT (JSON):
{
  "unitTitle": "clear unit title",
  "filename": "suggested-filename-slug",
  "yamlFrontmatter": "complete YAML frontmatter block",
  "content": "full markdown content with all sections",
  "description": "brief unit description for module index"
}`;

  const response = await fetch('https://models.github.ai/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 5000
    })
  });
  
  if (!response.ok) {
    throw new Error(`AI API error: ${response.statusText}`);
  }
  
  const result = await response.json();
  const aiContent = result.choices[0].message.content;
  
  // Parse JSON response
  let unitData;
  try {
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      unitData = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found');
    }
  } catch (err) {
    console.warn('Failed to parse JSON, using raw content');
    const titleMatch = aiContent.match(/^#\s+(.+)$/m);
    unitData = {
      unitTitle: titleMatch ? titleMatch[1] : docTopic.title,
      filename: docTopic.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      yamlFrontmatter: `---\ntitle: ${docTopic.title}\ndescription: Training content\n---`,
      content: aiContent,
      description: docTopic.title
    };
  }
  
  // Store the generated unit
  suggestion.generatedContent = {
    type: 'new_unit',
    unitTitle: unitData.unitTitle,
    filename: unitData.filename,
    yamlFrontmatter: unitData.yamlFrontmatter,
    content: unitData.content,
    description: unitData.description,
    moduleIndexUpdate: `Add to ${module.title}/index.yml:\n- ${unitData.filename}`
  };
  
  console.log('New unit generated:', suggestion.generatedContent);
}

function buildSourceFromGapSuggestion(suggestion) {
  const productName = state.selectedProduct?.name || 'Unknown Product';
  const gap = suggestion.gap;
  const docTopic = gap.docTopic;
  
  let title = docTopic.title;
  let description = `Training content for "${docTopic.title}"`;
  let rawText = '';
  
  // Build context based on action type
  switch (suggestion.actionType) {
    case ACTION_TYPES.EDIT_EXISTING:
      title = `Update: ${suggestion.targetModule}`;
      description = `Edit existing unit "${suggestion.targetUnit}" to better cover "${docTopic.title}"`;
      rawText = `Product: ${productName}\n\n# Action: EDIT EXISTING UNIT\n\nTarget Module: ${suggestion.targetModule}\nTarget Unit: ${suggestion.targetUnit}\n\n# Documentation Topic to Cover\nTitle: ${docTopic.title}\nPath: ${docTopic.path}\n\n# Current Coverage\n${gap.explanation}\n\n# AI Recommendation\n${suggestion.reasoning}\n\nConfidence: ${suggestion.confidence}%\nEffort: ${suggestion.estimatedEffort}`;
      break;
      
    case ACTION_TYPES.ADD_TO_UNIT:
      title = `Expand: ${suggestion.targetUnit}`;
      description = `Add new section to unit "${suggestion.targetUnit}" covering "${docTopic.title}"`;
      rawText = `Product: ${productName}\n\n# Action: ADD TO EXISTING UNIT\n\nTarget Module: ${suggestion.targetModule}\nTarget Unit: ${suggestion.targetUnit}\n\n# New Content Needed\nTitle: ${docTopic.title}\nPath: ${docTopic.path}\n\n# Context\n${gap.explanation}\n\n# AI Recommendation\n${suggestion.reasoning}\n\nConfidence: ${suggestion.confidence}%\nEffort: ${suggestion.estimatedEffort}`;
      break;
      
    case ACTION_TYPES.NEW_UNIT:
      title = `New Unit: ${docTopic.title}`;
      description = `Create new unit for module "${suggestion.targetModule}" covering "${docTopic.title}"`;
      rawText = `Product: ${productName}\n\n# Action: CREATE NEW UNIT\n\nTarget Module: ${suggestion.targetModule}\n\n# Documentation Topic\nTitle: ${docTopic.title}\nPath: ${docTopic.path}\n\n# Context\n${gap.explanation}\n\n# AI Recommendation\n${suggestion.reasoning}\n\nConfidence: ${suggestion.confidence}%\nEffort: ${suggestion.estimatedEffort}`;
      break;
      
    case ACTION_TYPES.NEW_MODULE:
      title = `New Module: ${docTopic.title}`;
      description = `Create entirely new module for "${docTopic.title}"`;
      rawText = `Product: ${productName}\n\n# Action: CREATE NEW MODULE\n\n# Documentation Topic\nTitle: ${docTopic.title}\nPath: ${docTopic.path}\n\n# Why New Module is Needed\n${gap.explanation}\n\n# AI Recommendation\n${suggestion.reasoning}\n\nConfidence: ${suggestion.confidence}%\nEffort: ${suggestion.estimatedEffort}`;
      break;
  }
  
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'module';
  
  return {
    title,
    description,
    rawText,
    slug,
    sourceUrl: docTopic.path || ''
  };
}

