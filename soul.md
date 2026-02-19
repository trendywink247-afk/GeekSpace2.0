# Soul Instructions System

## Overview

Soul Instructions are per-agent custom behavior text that shapes how agents respond.
They are stored server-side, editable in UI, and injected into prompts.

## Format

```json
{
  "soul_instructions": "You are a helpful coding assistant...",
  "safety_rules": ["Never share API keys", "Always validate inputs"],
  "privacy_level": "strict"
}
```

## Safety Rules

1. Soul instructions cannot override system security constraints
2. Instructions are filtered for prohibited content
3. User data in instructions is encrypted at rest

## Privacy

- Soul instructions are private to the user
- Not shared with other users
- Not used to train models
