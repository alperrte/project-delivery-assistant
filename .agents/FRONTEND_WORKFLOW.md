# Frontend Workflow

Use the installed frontend/design capabilities intelligently.

Do not invoke every skill mechanically.
Select skills according to their role and the current task.

## Phase 1 — Understand

Before changing UI:

- Inspect the existing frontend architecture.
- Inspect existing components, tokens, typography, colors, spacing and layout.
- Preserve an established design system unless redesign is requested.
- Understand the product and the purpose of the screen.

If useful for design-system direction, use:

- `ui-ux-pro-max:ui-ux-pro-max`
- `awesome-design`

Use Awesome Design primarily for reference and inspiration,
not for blindly copying another product.

## Phase 2 — Design Direction

For meaningful visual work, use the relevant installed design skills:

- `frontend-design:frontend-design`
- `taste-skill:taste-skill`
- `ui-ux-pro-max:ui-ux-pro-max`

Prioritize:

- strong visual hierarchy
- deliberate typography
- consistent spacing
- responsive layouts
- accessibility
- product-specific visual identity
- clear interaction states

Avoid generic AI-slop patterns such as:

- excessive cards
- unnecessary gradients
- excessive rounded containers
- icon boxes everywhere
- fake metrics or decorative dashboard elements
- excessive explanatory text
- arbitrary glassmorphism
- generic purple SaaS styling
- visual effects without functional purpose

## Phase 3 — Reference-Based Work

When the user provides a screenshot, mockup, reference image,
Figma export, or visual reference, use:

`taste-skill:image-to-code-skill`

Analyze:

- layout
- hierarchy
- spacing
- typography
- color relationships
- component structure

Reproduce the design principles while keeping the implementation
appropriate for the project's existing stack.

## Phase 4 — Implementation

Implement using the project's existing frontend stack.

Prefer existing:

- components
- tokens
- utilities
- conventions
- dependencies

Do not introduce a new UI library or design system unless necessary.

Keep components reusable where useful, but do not over-engineer.

## Phase 5 — Browser Validation

After significant UI implementation, use Playwright when available.

Check:

- rendering
- navigation
- responsive behavior
- forms
- interactive states
- overflow
- obvious console/runtime problems

Test the actual application rather than reasoning only from source code.

## Phase 6 — UI Audit

For major frontend changes, use:

`web-design-guidelines`

Check:

- accessibility
- keyboard interaction
- responsive behavior
- forms
- typography
- usability
- interaction patterns
- general web UI quality

Resolve meaningful findings.

## Phase 7 — Impeccable Final Pass

For substantial UI work, use Impeccable as appropriate.

Recommended sequence:

1. `/impeccable critique`
2. `/impeccable audit`
3. `/impeccable harden`
4. `/impeccable polish`

Do not blindly apply all suggestions.

Preserve intentional project-specific design decisions.

Use additional commands only when needed:

- `distill` for clutter
- `bolder` for overly generic designs
- `quieter` for overly loud designs
- `layout` for hierarchy/spacing problems
- `typeset` for typography problems
- `colorize` for weak color systems
- `adapt` for responsive issues
- `clarify` for poor UX copy
- `optimize` for frontend performance problems

## Completion Gate

For significant frontend tasks, do not declare completion until:

- the implementation works
- the UI is visually coherent
- responsive behavior is acceptable
- obvious accessibility problems are addressed
- browser validation has been performed when practical
- relevant design audit findings are resolved
- final polish has been considered

For tiny frontend changes, use judgment and skip unnecessary phases.