# Plan: PostHog Feedback Form

**Date:** 2026-02-19
**Status:** Done
**PR Scope:** Small
**Depends On:** Plan 09 (PostHog Analytics)

## Goal

Add a simple one-question feedback form that asks "What can we do to improve our product?" and captures the open-ended response via PostHog's survey capture API.

## Approach

Use PostHog's `posthog.capture('survey sent', {...})` event convention so responses appear in the PostHog Surveys dashboard. A "Give feedback" button triggers a modal overlay with a single textarea. Feedback logic lives in a new `web/src/feedback.ts` module wired into `main.ts`. The `SURVEY_ID` comes from `process.env.POSTHOG_SURVEY_ID` (matches a survey created in the PostHog dashboard).

Modal behaviour:
- Triggered by clicking "Give feedback" button (fixed bottom-right)
- Overlay darkens background; pressing Escape or clicking the backdrop dismisses it
- Submitting empty text is a no-op (validate before capture)
- After submit: show "Thanks for your feedback!" for 2 s then auto-close
- Dismiss (Escape / backdrop click) fires a `survey dismissed` event

Accessibility: `role="dialog"`, `aria-modal="true"`, focus trapped inside modal, close button has `aria-label="Close feedback form"`.

## Steps

1. Create `web/src/feedback.ts` — export `initFeedback()` which wires the button click to show the modal, handles submit/dismiss, and fires PostHog survey events
2. Add modal HTML to `web/src/index.html` (hidden overlay + textarea + submit/close buttons)
3. Add "Give feedback" trigger button to `web/src/index.html` (fixed bottom-right corner)
4. Add `trackSurveyShown()` and `trackSurveyDismissed()` to `web/src/analytics.ts`
5. Call `initFeedback()` in `web/src/main.ts` after `initAnalytics()`

## Todo

- [x] Create `web/src/feedback.ts` with `initFeedback()` exported function
- [x] Add modal HTML to `index.html` (hidden overlay, textarea, submit/close buttons)
- [x] Add "Give feedback" button to `index.html` (fixed bottom-right)
- [x] Add `trackSurveyShown()` and `trackSurveyDismissed()` to `analytics.ts`
- [x] Wire `initFeedback()` into `main.ts`
- [x] Verify survey responses appear in PostHog Surveys tab (manual — requires POSTHOG_SURVEY_ID env var and live PostHog dashboard)

## Key Details

**PostHog survey capture convention:**
```ts
// When modal opens
posthog.capture('survey shown', { $survey_id: SURVEY_ID });

// On submit
posthog.capture('survey sent', {
  $survey_id: SURVEY_ID,
  $survey_response: responseText,
});

// On dismiss (Escape / backdrop click)
posthog.capture('survey dismissed', { $survey_id: SURVEY_ID });
```

**Environment variable:** `POSTHOG_SURVEY_ID` — UUID of the survey created in the PostHog dashboard. If missing, feedback button is hidden (same no-op pattern as analytics).

**Survey question:** "What can we do to improve our product?" (open text, no character limit enforced beyond a reasonable textarea max).
