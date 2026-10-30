---
name: design-review
description: Casa Check's design judgment — what the interface is for, what restraint means here, the colour and contrast rules, and the specific mistakes this project has already made. Use before changing anything visual, and when reviewing a UI change.
---

# Designing Casa Check

Generic web design advice is written for marketing landing pages. This is not
one. Applying that advice here makes the product worse, so this file exists to
say what good looks like for *this* thing.

## What the interface is actually for

A renter uses Casa Check **twice, months apart**, standing in a room, usually
one-handed, often in poor light, while doing something else. Between those two
uses they forget everything about it.

Everything below follows from that:

- **Orientation beats beauty.** Returning after four months, the first question
  is always "what did I already do?" Counts, states and progress belong where
  they can be seen, not discovered.
- **The phone is the real device.** A layout that is lovely at 1300px and
  awkward at 375px is a failure, not a trade-off.
- **It is evidence, not content.** Photos are the record. Anything that crops,
  compresses, reorders, or obscures them is working against the product.
- **The user is stressed and possibly out of money.** Copy should be calm and
  concrete. No exclamation marks, no cheerleading, no cute empty states.

## The system

Colours live in `src/styles/tokens.css` and **only** there. Never write a hex
value in a component or another stylesheet.

| token | meaning |
|---|---|
| `--teal` | move-in / original condition / primary action |
| `--amber` | move-out / later / the report export |
| `--amber-text` | amber **as text on white** — the fill colours fail contrast at small sizes |
| `--ink` / `--muted` | body and secondary text |
| `--paper` / `--card` | page ground and raised surfaces |
| `--sidebar*` | the dark rail and its text |

Teal and amber carry meaning. Do not use either decoratively, and do not
introduce a third accent — the two-colour pairing is what makes the compare
screen legible at a glance.

Type is Manrope for display, Inter for body, both from `tokens.css`.

## Restraint

This project was audited against a list of tells that a site was
machine-generated. It passed on almost all of them, and that is worth keeping.
Do not add: gradients, glassmorphism, neon or pastel palettes, radial orbs, dot
grids, sparkle icons, bento grids, emoji, animated arrows, decorative drop
shadows, or a third "feature card" row.

Two it did not pass, both since fixed, both worth remembering:

**Accent stripes multiply.** Four different coloured left borders accumulated
for four unrelated jobs before anyone noticed the pattern. Exactly one survives
— the sidebar's active-step marker. Before adding a coloured edge, check
whether something already carries that meaning.

**Trust claims should be stated plainly, not decorated.** The privacy statement
on Property setup is deliberately undecorated. A claim about where someone's
photos go reads as more credible flat than in a callout box.

## Contrast is enforced, not aspirational

`npm run verify` runs axe against every screen at both widths and **fails the
build** on WCAG AA violations, colour-contrast included. This is not decorative:
four real failures were found the day it was switched on, and the worst of them
was the legal disclaimer.

Two lessons encoded in the tokens:

- A colour that works as a **fill** often fails as **text**. `--amber` is fine
  behind dark text and fails as 9.5px text on white; that is why `--amber-text`
  exists.
- When a button fails contrast, consider **darkening the text before darkening
  the brand colour.** White on `--amber` is 2.67:1; ink on the same unchanged
  amber is 6.89:1. The fix cost nothing visually.

If you add or change a colour, compute the ratio against every ground it sits
on before committing. 4.5:1 for normal text, 3:1 for large.

## Before you commit anything visual

1. `npm run verify` — builds, seeds real photos, drives all five steps at 375px
   and 1300px, runs axe, writes screenshots to `verify/`.
2. **Open the screenshots.** The checks are a floor. Things they cannot catch
   have all happened here: four identical hint boxes stacked down a page, a
   sidebar badge wrapping its label, thumbnails collapsing to one column on
   phones, a media-query rule placed before its base rule so it silently never
   applied.
3. Ask whether the change earns its place. Most of this project's design wins
   have been *removals*.

## Scope

The user's standing rule: **polish within the system is welcome; palette and
layout changes need approval.** Hierarchy, spacing, empty states, progress
signals and mobile behaviour are yours. Colours, the sidebar structure, and the
overall layout are not — ask first. Accessibility defects are an exception:
fix them, then say clearly what you changed and show the measured ratios.
