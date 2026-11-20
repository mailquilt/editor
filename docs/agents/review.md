# Reviewing code

Six broad reviews ran before `0.1.0` (#36). Each had the same open-ended brief and no memory of the last, so each found more and patched it, and the code grew. This page keeps a review to one question, with a bar and an end.

## Name the question first

A review answers one question. If the request doesn't say which, ask.

- **Is it ready to ship?** Report only findings at the release bar. Start with "ready" or "not ready".
- **How well is it written?** One reviewer reads the whole package as a design. Score each area out of 10, give the reason for every point lost, then the three to five changes that would raise the score most.
- **What's wrong with this change?** Review the diff and the code it touches, nothing else.

## The release bar

A finding blocks a release only if it:

- crashes, or loses or damages an email
- opens a security hole
- stops keyboard or screen reader users from doing something
- makes the code do something other than what the docs promise

A red `main` blocks a release too, whatever made it red, a flaky test or a broken workflow included. CI publishes only a commit that passed every check, so the release waits until `main` is green again.

Anything else goes in the backlog issue, unless the maintainer asks for it.

## Briefing reviewers

- Don't limit how many findings to report, and don't say "look harder". "Nothing found" is a good answer.
- Give each reviewer the release bar and `docs/agents/decisions.md`.
- Split the work by package only to look for bugs. Judging design needs one reviewer who sees the whole package, because problems like key handling cross files.
- Ask for each finding's severity against the bar, not only whether it's true.

## Reporting

- Start with the verdict: ready or not, and the score if one was asked for.
- Then the findings at the bar. Then everything else in one short list, headed "Not for this release".
- "Safe to ship" and "well written" are separate answers. Don't give one as the other.
- A finding being true doesn't make it worth doing. Say which ones are.

## Fixing what a review found

- **A bug:** the smallest fix at its root cause, with a test that fails without it.
- **A design problem:** one change per theme, such as one map for every key, with a short ADR in `docs/adr/`. Not a patch at every place it shows.
- A PR that reverses anything in `docs/agents/decisions.md` says so, with the reason, and updates that page.
- Change a test only when the code it checks changes, or when the test is wrong.

## Stopping

Stop when a review finds nothing at the bar. Don't start another broad review because of what the last one found below it.
