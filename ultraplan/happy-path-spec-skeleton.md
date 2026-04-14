---
type: plan
tier: semantic
summary: "LLM-facing happy-path contemplation brief: purpose, boundaries, locked context, and open questions"
tags: [happy-path, spec, interview, llm-brief]
updated: 2026-04-13
decay: 30d
status: active
source: ai
---

# DiveDispatch Happy Path — LLM Contemplation Brief

**Status:** Active working brief for another reasoning model

## What This Is

This document is a thinking brief for an LLM that needs to **understand**, **interrogate**, and **improve** the DiveDispatch happy path.

It is not an execution script.

Its purpose is to help another model:
- understand what the happy path is trying to prove
- understand the start point and end point
- see which parts are already decided
- identify missing decisions, hidden assumptions, contradictions, and weak spots
- ask better questions before anyone tries to automate or execute the path

## What This Is Not

This is not:
- a seed-data shortcut
- a quick demo route
- a browser walkthrough checklist
- a narrow “can we make one booking succeed?” script

The happy path here is intentionally broader than that.

## Goal

The goal of the happy path is to probe **every nook and cranny required for a real booking to succeed**.

The happy path exists to prove that DiveDispatch’s distributed system truly converges under realistic conditions:
- stakeholders are created through the real UI
- profiles, preferences, and settings really persist
- booking creation really works from scratch
- customer communications really happen through actual channels
- customer portal behavior really supports partial progress and later completion
- preference cascades, referral behavior, visibility, and confirmations really work together
- the booking really advances through its real lifecycle
- post-trip conversion really exists beyond the booking itself

### Why This Exists

The product thesis is not “a booking row can be created.”

The product thesis is that a multi-stakeholder dive booking can move from initial setup to a successfully completed booking without hidden failures in the handoffs between:
- operator
- customer
- instructor
- boat
- pool
- equipment
- compressor
- post-trip customer conversion

### Why Seed-Data Shortcuts Are Not Enough

A seeded shortcut can make a booking appear to work while bypassing the exact surfaces that matter:
- account creation
- onboarding completeness
- persistence
- invite delivery
- portal save/resume
- reminder timing
- resource assignment/fallback
- referral-mode preference shifts
- reservation creation integrity
- post-trip account conversion

Existing observations already show why this matters: a booking can appear far along while still missing required reservations and therefore never truly converge.

## Start Point

The happy path starts from **zero meaningful pre-created business state**.

That means:
- no seed-data shortcut for the actors involved in the path
- stakeholders needed for the booking are created through the UI
- their onboarding, profile, preferences, and settings are completed through the UI
- persistence is verified through the actual product surfaces

## End Point

The booking end point is:

- a booking reaches **`Completed`** status
- it has passed through every normal phase except `Cancelled`
- it remains visible/persistent where expected
- the customer is prompted to create an account
- account creation is pre-populated from portal data
- the customer can finish account information
- the customer is asked to leave a review

The happy path therefore ends **after** booking completion, not merely at it.

## Scope

This brief covers:
- stakeholder creation
- stakeholder onboarding depth
- persistence expectations
- booking creation
- customer invite channels
- customer portal behavior
- incomplete-state reminders
- preference and referral behavior
- resource assignment and fallback
- booking visibility and state transitions
- post-trip customer conversion

## Out of Scope

Out of scope unless explicitly pulled back in:
- using seed data to fast-forward the path
- simplifying away stakeholder setup phases
- collapsing the path into a single booking demo without testing prerequisite surfaces
- treating this as a pure browser script instead of a system-design probe

## How Another LLM Should Use This Document

Read this brief as a map of:
1. what is already settled
2. what is still unknown
3. what seems internally contradictory
4. what would make the happy path stronger or more realistic

The right behavior is:
- understand the journey from start to finish
- test the coherence of the path conceptually
- ask clarifying questions where the path is underspecified
- identify missing phases, weak assertions, and hidden dependency gaps
- surface opportunities where the happy path is too narrow and would miss important failures

The wrong behavior is:
- blindly translate this into procedures
- assume every `LOCKED` item is already implemented in code
- assume current product behavior matches product intent
- shortcut directly to booking creation

## Authorities / Best Reference Documents

Use these as primary authorities while thinking:

- `Vaults/DiveDispatch/Product/Product Definition.md`
- `Vaults/DiveDispatch/Product/V1 Done Criteria.md`
- `Vaults/DiveDispatch/Product/HappyPath.md`
- `Vaults/DiveDispatch/Product/WhatAmIDoing.md`
- `Vaults/DiveDispatch/Product/Launch-Walkthrough.md`
- `Vaults/DiveDispatch/HappyPath/Stops.md`
- `Vaults/DiveDispatch/HappyPath/Observations.md`

Use `Observations.md` as a reminder that conceptual completeness and real convergence are not the same thing.

## Locked Context

These are the decisions already made in-session.

### 1. Global Rules

#### 1.1 `LOCKED` No seed data
All entities used in the happy path are created through the UI.

#### 1.2 `LOCKED` Booking finish line = `Completed`
The booking goes through every normal stage except `Cancelled`.

#### 1.3 `LOCKED` Happy path extends beyond booking completion
It includes:
- customer account-creation prompts
- prefilled account conversion
- customer finishing account info
- review prompt

#### 1.4 `LOCKED` Persistence matters everywhere
If data should persist in production, it must persist in development during the happy path.

#### 1.5 `LOCKED` Stakeholder creation is not compressed into one setup block
Each stakeholder type gets its own deep phase.

### 2. Stakeholder Strategy

#### 2.1 `LOCKED` Resource stakeholders are created before operator stakeholders

#### 2.2 `LOCKED` Agent is the last stakeholder/operator created

#### 2.3 `LOCKED` Each stakeholder creation phase includes
- account creation
- role selection
- onboarding
- required fields
- optional fields
- preferences/settings
- persistence verification

### 3. Instructor Matrix

#### 3.1 `LOCKED` Four in-system instructors exist
1. English-only
2. Traditional Chinese
3. Simplified Chinese
4. Thai-only

#### 3.2 `LOCKED` During booking, each day uses one of the four instructors

#### 3.3 `LOCKED` There will still be insufficient instructor coverage

#### 3.4 `LOCKED` Agent or dive center can add an extra instructor as free text

#### 3.5 `LOCKED` External / not-in-system instructor is allowed in the happy path

### 4. Agent Setup

#### 4.1 `LOCKED` A new user creates an account and selects `Agent`

#### 4.2 `LOCKED` They land on the Agent dashboard

#### 4.3 `LOCKED` They go to avatar/profile/settings

#### 4.4 `LOCKED` They fill all agent fields
- required
- optional
- preferences
- settings

#### 4.5 `LOCKED` Agent data persistence must be verified

#### 4.6 `LOCKED` In settings
- default referral is unchecked
- preferred dive center is still set

### 5. Booking Start

#### 5.1 `LOCKED` Agent creates the first booking

#### 5.2 `LOCKED` Agent drags the `O+AP` quick-book pill onto tomorrow

#### 5.3 `LOCKED` Booking page / booking flow opens

### 6. Customers and Invite Channels

#### 6.1 `LOCKED` Step 1 begins as normal

#### 6.2 `LOCKED` Three customers are added

#### 6.3 `LOCKED` Customer 1
- English
- American phone number
- link sent by email

#### 6.4 `LOCKED` Customer 2
- Simplified Chinese
- Chinese phone number
- link sent by WhatsApp

#### 6.5 `LOCKED` Customer 3
- Traditional Chinese
- Taiwan phone number
- link sent by LINE

#### 6.6 `LOCKED` Each customer must receive their invite link before the agent can click Next

### 7. Partial Portal Progress

#### 7.1 `LOCKED` Customers can save and resume later

#### 7.2 `LOCKED` Partial progress is intentional in the happy path

#### 7.3 `LOCKED` Customer 1 fills out Step 1 only

#### 7.4 `LOCKED` Customer 2 fills out Step 2 only

#### 7.5 `LOCKED` Customer 3 fills out Step 3 only

#### 7.6 `LOCKED` None of them submit at that point

#### 7.7 `LOCKED` This incomplete state exists so reminder behavior can be tested

### 8. Referral / Preference-Switch Test

#### 8.1 `LOCKED` The happy path is about testing feature combinations, not choosing one booking mode

#### 8.2 `LOCKED` One booking should switch modes

#### 8.3 `LOCKED` Booking starts with agent default referral off

#### 8.4 `LOCKED` In Step 2, the agent can re-check referral to the preferred dive center

#### 8.5 `LOCKED` Step 2 is the switch point from agent-driven to referral-driven behavior

#### 8.6 `LOCKED` After referral is toggled on, booking behavior should reflect the dive center’s preference source

### 9. Resource Assignment / Visibility

#### 9.1 `LOCKED` The booking must support both in-system instructor matching and free-text external instructor fallback

#### 9.2 `LOCKED` All involved stakeholders should be able to view the booking appropriately

#### 9.3 `LOCKED` Successful booking must persist and remain viewable by all stakeholders involved

### 10. Portal Completion and Convergence

#### 10.1 `LOCKED` Eventually the customers complete the portal

#### 10.2 `LOCKED` Portal phases include
1. Contact & Identity
2. Medical
3. Waiver
4. Equipment
5. Safety

#### 10.3 `LOCKED` Booking cannot converge until customer-side completion is done

#### 10.4 `LOCKED` Original customer contact method matters from booking creation through later reminders/prompts

#### 10.5 `LOCKED` If forms are still incomplete before the designated time, the customer should be reminded

#### 10.6 `LOCKED` Day-before reminder belongs in the happy path design

#### 10.7 `LOCKED` Last-day / post-trip message also belongs in the happy path design

#### 10.8 `LOCKED` The post-trip message includes
- create account
- finish account info
- leave review

#### 10.9 `LOCKED` Booking auto-advances when all conditions converge

#### 10.10 `LOCKED` Conditions include
- operator side complete
- customer side complete
- required resources confirmed
- no blocking condition

#### 10.11 `LOCKED` No one manually triggers the advance

### 11. Completion and Post-Trip Conversion

#### 11.1 `LOCKED` `Active` matters as a display phase in the journey

#### 11.2 `LOCKED` The final booking status is `Completed`

#### 11.3 `LOCKED` Booking persists and remains viewable to all stakeholders involved

#### 11.4 `LOCKED` Customer is asked to create an account

#### 11.5 `LOCKED` Account creation should be pre-populated from portal data

#### 11.6 `LOCKED` Customer should be able to finish remaining account information

#### 11.7 `LOCKED` Customer is also asked to leave a review

#### 11.8 `LOCKED` The happy path includes three account-creation prompts
1. after portal submission
2. 8pm day before activity
3. after booking completion with review prompt

#### 11.9 `LOCKED` Post-conversion state should include
- account holder exists
- dive/trip history preserved
- future reuse/prefill benefits exist

## Open Questions the Next LLM Should Pressure-Test

These are not just blanks to fill. These are places where hidden assumptions, contradictions, or weak coverage may exist.

### A. Stakeholder Setup
- Exact stakeholder creation order?
- Exact field checklist per stakeholder role?
- Which resource roles are truly in scope?
- Which operator roles are truly in scope before Agent?

### B. Instructor Coverage
- Exact day-to-instructor assignment?
- Exact point where external free-text instructor enters?
- Does the path need to prove language matching failure before fallback?

### C. Invite Delivery
- What counts as successful invite receipt?
- Is link generation enough, or must true outbound delivery be proven?
- Must all three channels be proven with real delivery semantics or only product-surface semantics?

### D. Portal and Localization
- What exactly must localize by customer language?
- Full portal chrome, only defaults, or both?
- Does language change later trigger reassignment behavior inside the happy path?

### E. Referral / Preference Shift
- Which exact fields must visibly change when referral is toggled on?
- Should already-selected values be replaced immediately or only if empty?
- Is there a contradiction between preferred-operator prefill and referral-toggle timing that needs to be resolved?

### F. Visibility / Acceptance / Convergence
- When does each stakeholder first see the booking?
- Which stakeholders are auto-accept vs manual-accept in the canonical path?
- What exact combination of manual and automatic confirmations gives the strongest coverage?

### G. Reminder Logic
- What exact reminder sequence should the canonical path prove?
- Must reminders use the original operator-selected send channel or a later customer-declared contact method?
- How long should the booking intentionally remain incomplete before reminders fire?

### H. Medical / Blocking Behavior
- Should the canonical happy path remain medically clean?
- Or should one customer trigger a block and later unblock?
- Is medical-block coverage better kept in a separate branch rather than inside the happy path?

### I. Post-Trip Conversion
- What exact “remaining account information” fields are part of conversion?
- Is successful arrival at prefilled signup enough, or must full account creation complete?
- Should the happy path also prove first repeat-use behavior after conversion?

## Known Implementation Tensions

Another LLM should keep these tensions in mind while reasoning:

1. Product intent and implementation are not identical.
2. Some reminder and messaging behaviors are clearly specified in docs but only partially implemented.
3. Referral and preference-cascade behavior has known drift risk.
4. Existing walkthrough observations show a booking can appear healthy while still missing required reservation writes.
5. Post-trip conversion is conceptually richer in the docs than in clearly finished UX.

## Opportunities to Look For

When reviewing this happy path, actively look for opportunities such as:
- places where one scenario can validate multiple feature combinations without becoming incoherent
- places where a “happy path” is too sanitized and therefore misses real operational weakness
- places where persistence, notification, or visibility expectations are underspecified
- places where a seeded shortcut would hide a critical failure surface
- places where the path should branch into a separate unhappy-path instead of bloating the canonical journey

## Anti-Patterns for the Next LLM

Do not:
- reduce this to “make one booking succeed quickly”
- assume seed-data shortcuts are acceptable replacements
- assume every locked item is already implemented in code
- collapse stakeholder setup into a trivial prerequisite
- confuse the purpose of this document with the purpose of `/happypath` execution stops

## Resume Point

Continue by reviewing the open questions one cluster at a time and improving the path’s conceptual integrity before turning it into any procedural or executable format.
