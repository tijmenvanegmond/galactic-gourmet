# Working on this project

## Offer the playtest before automating it

Before verifying a gameplay change in the browser, stop and offer to let the
user try it. Say what changed and what to look for, and wait.

This is a game: whether a control feels right is a judgement only the person
holding it can make, and driving it through synthesised pointer events is slow,
awkward and prone to testing the harness instead of the change. Reserve browser
automation for things the user cannot easily see — numeric checks, or a state
that is hard to reach by hand — and only after they have said to go ahead.

Typechecking (`npm run typecheck`) needs no such pause. Run it every time.
