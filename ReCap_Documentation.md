# ReCap — AI Study Co-Pilot

> One-line pitch: *Turn every class, meeting & deadline into a weekly study plan — automatically.*

ReCap is a web app for students that ingests recorded meetings, uses AI to summarize key points and pull out deadlines, builds a weekly study plan, and keeps a live calendar + Gmail-based alerts so nothing slips through.

---

## 1. The Problem

Students juggle recordings, scattered deadlines, surprise schedule changes, and no real plan:

| Pain | Consequence |
|---|---|
| Recorded lectures/meetings go unwatched | Knowledge stays trapped in 60-min files |
| Deadlines mentioned verbally, never written down | Missed submissions |
| Last-minute cancellations / reschedules | Confusion, missed classes |
| "I'll study later" with no structure | Poor exam prep |

## 2. The Solution

A single loop: **Capture → Organize → Remind.**

1. **Capture** — upload recorded meetings.
2. **Organize** — AI summarizes, breaks down key notes, extracts important dates.
3. **Remind** — weekly study plans, calendar events, and Gmail alerts for cancellations/reschedules/exams.

## 3. Core Features

- **Meeting Intelligence** — transcription, concise summary, topic breakdown, open-question list.
- **Auto Date Capture** — extracts deadlines with the right precision: date + time when discussed, date-only when time isn't mentioned.
- **Weekly Study Plan** — AI generates a balanced 7-day plan to hit tasks; re-balances automatically when a new deadline appears.
- **Gmail Alerts** — sends cancellation / reschedule / exam reminders straight to the student's inbox.
- **Calendar Integration** — every class, exam, and deadline recorded in one in-app calendar view.

## 4. How It Works (Pipeline)

```
Upload recording
   → AI summarizes & breaks down notes
   → Extracts dates & deadlines
   → Generates weekly study plan
   → Writes events to Calendar + sends Gmail alerts
```

## 5. Architecture

| Layer | Component |
|---|---|
| Ingestion | Web upload of audio/video recordings |
| AI Core | Speech-to-text → LLM summarization + entity/date extraction → plan generation |
| Calendar | In-app calendar storing date (+time) events |
| Alerts | Gmail connector for cancellations, reschedules, exam reminders |

*Illustrative stack:* speech-to-text · LLM · entity extraction · Gmail/Calendar APIs · web app.

## 6. Can an AI Agent Use WorkBuddy to Build This?

**Yes.** WorkBuddy is an agent platform, not just an IDE — it gives an agent the exact toolkit ReCap needs to run end-to-end:

| ReCap capability | WorkBuddy capability |
|---|---|
| Summarize, extract dates, build plan | **LLM reasoning** (the agent itself) |
| Read inbox / send alerts | **Gmail & Calendar connectors** |
| Add transcription, search, custom logic | **Skills & MCP servers** (modular, pluggable) |
| Fire reminders, re-plan on changes | **Hooks & scheduling** (timer / cron triggers) |
| Operate the web app end-to-end | **Browser automation** |

An agent on WorkBuddy can orchestrate the whole pipeline — ingest recording → LLM → extract dates → write calendar → send Gmail alerts → run reminders on schedule — without manual wiring of each step.

## 7. Getting Started (Brief)

1. Upload a recorded meeting via the web app.
2. Wait for AI summary + extracted deadlines.
3. Open the weekly plan; adjust if needed.
4. Check the calendar and your Gmail for alerts.

## 8. Suggested Next Steps

- **Now** — core capture → summarize → calendar loop.
- **Next** — Gmail alerts + auto weekly re-planning.
- **Later** — multi-student sharing, LMS integration, mobile push reminders.

---

*ReCap — because the smartest students still need a system.*
