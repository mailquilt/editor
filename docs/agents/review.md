# Reviewing code

Six broad reviews ran before `0.1.0` (#36). Each had the same open-ended brief and no memory of the last, so each found more and patched it, and the code grew. This page keeps a review to one question, with a bar and an end.

## Name the question first

A review answers one question. If the request doesn't say which, ask.

- **Is it ready to ship?** Report only findings at the release bar. Start with "ready" or "not ready".
- **How well is it written?** One reviewer reads the whole package as a design. Score each area out of 10, give the reason for every point lost, then the three to five changes that would raise the score most.
- **What's wrong with this change?** Review the diff and the code it touches, nothing else.

## Review each change before it merges

Four broad audits ran before `0.2.0`. Their scores never rose, because each looked harder than the last, and several of the bugs they found had come in with the fixes for the audit before. The one review that was cheap and found what mattered read only what had merged since the last one. So the review that runs every time is the third question, on each pull request, against the release bar below:

- Read the diff and the code it touches. For a refactor, compare what the old code did with what the new code does.
- Check each sentence the pull request adds to the docs or a changeset against the code, by running it or by a test.
- A change to a public type, or to the saved format, is a breaking change, and its changeset says "Breaking".

A broad review of the whole codebase is for before a major version, or when the maintainer asks for one.

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

## Before the pull request

Run `/code-review` once, when the work is finished. For a change to the editor's interface or the site, run the fresh design review (`docs/agents/design.md`, step 7) at the same time. Run either again only when the fixes changed more than the findings asked. On mailquilt, running the code review again after each round of fixes cost about 10 minutes a ticket.

## On a pull request

CodeRabbit reviews a pull request once, when it opens, and a later push isn't reviewed again unless someone asks with `@coderabbitai review`. A round of review on each push took about five minutes, and CI another seven, and fixes pushed a few minutes apart cancelled CI before it could finish.

- Open the pull request ready for review, not as a draft, as neither CodeRabbit nor CI checks a draft. Open it once the work is committed, and its lint, types, unit tests and the browser tests it touches pass. CI runs every browser suite in all three browsers, so a last full run on your machine before opening it only holds up the review. Say the checks pass only once CI has passed.
- Wait for CodeRabbit's review and CI, then check each finding against the code, as for any review.
- Fix the findings worth doing in one commit and one push. A finding below the release bar goes in that commit if it's quick, or in the backlog issue. It never starts another round.
- Answer a pre-merge check's warning in a comment on the pull request. Push a change for it only when the code, a changeset or a doc is wrong.
- Merge once the required checks pass. Don't wait for CodeRabbit to review the fix, or ask it to, unless the fix changed more than the findings asked.

## Stopping

Stop when a review finds nothing at the bar. Don't start another broad review because of what the last one found below it.
