# START HERE — AutoForge launch pack for PsyLink

This file explains how to use the prepared documents for starting PsyLink implementation in AutoForge.

---

## Goal
Launch the **first implementation wave** of PsyLink correctly, without product drift, scope explosion, or unsafe AI assumptions.

---

## Use these files in this order

### 1) Read first
**`PsyLink_AutoForge_Brief_ru.md`**

Why:
- gives AutoForge the product identity,
- explains what PsyLink is and is not,
- defines non-negotiable rules,
- prevents drift into “AI therapist” or “full clinic OS”.

---

### 2) Then read
**`PsyLink_PRD_v2_AutoForge_ru.md`**

Why:
- this is the main implementation-oriented PRD,
- contains product logic, module boundaries, priorities, security model,
- includes vector DB and future graph-analysis architectural guidance.

---

### 3) Then read
**`PsyLink_AutoForge_Task_Seed_ru.md`**

Why:
- contains initial task decomposition,
- gives task IDs, dependencies, acceptance criteria,
- helps AutoForge structure the first execution wave.

---

### 4) Then use as kickoff instruction
**`PsyLink_AutoForge_Kickoff_Prompt_ru.md`**

Why:
- this is the best first prompt to paste into AutoForge,
- tells it how to think about the product,
- tells it what to prioritize first,
- asks for the correct first planning output.

---

## Recommended startup sequence

### Step 1
Load or attach these 4 files into AutoForge context:
- `PsyLink_AutoForge_Brief_ru.md`
- `PsyLink_PRD_v2_AutoForge_ru.md`
- `PsyLink_AutoForge_Task_Seed_ru.md`
- `PsyLink_AutoForge_Kickoff_Prompt_ru.md`

### Step 2
Use the contents of `PsyLink_AutoForge_Kickoff_Prompt_ru.md` as the first control prompt.

### Step 3
Ask AutoForge to produce the first planning output:
- grouped tasks,
- dependencies,
- architectural risks,
- security risks,
- recommended first coding milestone.

### Step 4
Only after that let it start implementation.

---

## What AutoForge should build first

Priority order:
1. encryption foundation
2. consent + therapist/client linkage
3. secure diary storage
4. therapist workspace
5. session transcript + summary
6. timeline
7. exercise sending
8. conservative safety layer

If it tries to jump ahead into graph analytics, heavy admin systems, or broad AI automation, pull it back.

---

## Important implementation reminders

### Security
All sensitive client materials must be encrypted:
- at rest,
- in transit,
- with application-layer protection for sensitive payloads.

### AI boundaries
Do not let the system become framed as:
- autonomous AI therapist,
- diagnosis engine,
- keyword-only crisis detector.

### Architecture
Use vector DB support now.
Prepare for graph-analysis later.
Do not make graph complexity a blocker for V1.

---

## What success looks like for the first wave
A therapist should be able to:
- link a client with consent,
- view secure diary material,
- upload a session recording,
- get transcript + summary,
- see unified timeline,
- send an exercise,
- trust that sensitive content is protected.

---

## If you need a very short launch instruction
Use this:

> Read `PsyLink_AutoForge_Brief_ru.md`, `PsyLink_PRD_v2_AutoForge_ru.md`, and `PsyLink_AutoForge_Task_Seed_ru.md`. Then follow `PsyLink_AutoForge_Kickoff_Prompt_ru.md` as the controlling instruction. Produce a first-wave implementation plan before writing code. Prioritize encryption, consent, secure diary storage, therapist workspace, and session transcript/summary. Architect for vector DB now and future graph analysis later, without making graph dependencies mandatory in V1.
