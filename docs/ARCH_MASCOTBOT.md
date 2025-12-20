# ARCH: MascotBot / Avatar / Voice

## Evidence & required components

Mini-TOC

- [Evidence & required components](#evidence--required-components)
- [Unknowns / To provide](#unknowns--to-provide)
- Related docs: [EFRO System Map](EFRO_SYSTEM_MAP.md), [Environment](ENVIRONMENT.md), [OPS Runbook](OPS_RUNBOOK.md)

- ElevenLabs signed URL route expected:
  - Prescribed file: src/app/api/get-signed-url/route.ts
  - Prescribed code pattern (from .github/copilot-instructions.md):
    const client = new ElevenLabs({ apiKey: process.env.ELEVENLABS_API_KEY });
    const signedUrl = await client.realtime.sessions.create({ agentId: process.env.ELEVENLABS_AGENT_ID, dynamicVariables });
    return NextResponse.json({ signedUrl });
  - Current implementation file: UNBEKANNT (search performed for src/app/api/get-signed-url/route.ts — not present in working set).

- Mascot render usage:
  - Pattern documented in repo:
    <MascotClient src="/bear.riv" artboard="Character" inputs={["is_speaking","gesture"]}><MascotRive /></MascotClient>
  - Source: .github/copilot-instructions.md (MascotBot Rules)

- LipSync integration:
  - Must use useMascotElevenlabs with naturalLipSync true (documented requirement).
  - Evidence: .github/copilot-instructions.md

## Unknowns / To provide
- Actual React/Next components that render MascotClient in the UI (search for MascotClient usage in src/app) — UNBEKANNT (search performed).
- Implementation of get-signed-url route — UNBEKANNT.

