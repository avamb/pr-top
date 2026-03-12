const fs = require('fs');
var code = fs.readFileSync('src/frontend/src/pages/ClientDetail.jsx', 'utf8');

// Step 1: Add expected_updated_at before the fetch call
var marker1 = "if (Object.keys(body).length === 0) {\n        setContextMsg('Please fill in at least one field.');\n        setContextSaving(false);\n        return;\n      }\n\n      const res = await fetch(";
var replacement1 = "if (Object.keys(body).length === 0) {\n        setContextMsg('Please fill in at least one field.');\n        setContextSaving(false);\n        return;\n      }\n\n      // Send expected_updated_at for optimistic concurrency control\n      if (context && context.updated_at) {\n        body.expected_updated_at = context.updated_at;\n      }\n\n      const res = await fetch(";

// Step 2: Add 409 conflict handling after the fetch response check
var marker2 = "      if (!res.ok) {\n        const data = await res.json().catch(() => ({}));\n        throw new Error(data.error || 'Failed to save context');\n      }\n      const data = await res.json();\n      setContext(data.context);\n      setContextDirty(false);\n      setContextMsg('Context saved successfully!');";
var replacement2 = "      if (res.status === 409) {\n        // Conflict detected - another session modified the context\n        const conflictData = await res.json().catch(() => ({}));\n        if (conflictData.conflict && conflictData.latest_context) {\n          setContext(conflictData.latest_context);\n          setContextForm({\n            anamnesis: conflictData.latest_context.anamnesis || '',\n            current_goals: conflictData.latest_context.current_goals || '',\n            contraindications: conflictData.latest_context.contraindications || '',\n            ai_instructions: conflictData.latest_context.ai_instructions || ''\n          });\n          setContextDirty(false);\n        }\n        setContextMsg('Conflict: Context was modified in another session. The latest version has been loaded. Please review and save again.');\n        setContextSaving(false);\n        return;\n      }\n\n      if (!res.ok) {\n        const data = await res.json().catch(() => ({}));\n        throw new Error(data.error || 'Failed to save context');\n      }\n      const data = await res.json();\n      setContext(data.context);\n      setContextDirty(false);\n      setContextMsg('Context saved successfully!');";

if (!code.includes('expected_updated_at')) {
  code = code.replace(marker1, replacement1);
  code = code.replace(marker2, replacement2);
  fs.writeFileSync('src/frontend/src/pages/ClientDetail.jsx', code);
  console.log('Patched ClientDetail.jsx successfully');
} else {
  console.log('Already patched');
}
