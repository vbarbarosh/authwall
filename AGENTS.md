# authwall

An authentication proxy: it sits between clients and an internal app, handles
sign-in, and forwards authenticated requests with an `X-Auth-User` header.
Node.js 24, Express 5, knex over SQLite, MySQL or PostgreSQL, CommonJS.

## The project

| Command | What it does |
|---|---|
| `bin/configure` | after `git pull`: `npm install` and the Playwright browsers |
| `bin/run` | run the app |
| `bin/watch` | run it, restarting on changes |
| `bin/test` | every suite: unit, api, e2e (`npm test`) |
| `npm run test:unit` | `config/**/*.test.js` and `src/**/*.test.js`, next to the file they test |
| `npm run test:api` | `tests/api/`, each run on its own temporary SQLite file, never `data/` |
| `npm run test:e2e` | `tests/playwright/`, Chromium, Firefox and WebKit |
| `bin/build` | the Docker image |
| `bin/build-docs` | the documentation site from `docs/` into `build/docs/` |
| `bin/migrate`, `bin/migrate-make`, `bin/migrate-rollback` | database migrations in `db/migrations/` |
| `bin/release major\|minor\|patch` | bump, commit and tag on `production` |

- `src/` the app, a folder per part (`routes/`, `actions/`, `services/`,
  `helpers/`, `oauth_providers/`, `http/`); `config/` turns the environment
  into configuration; `design/` the SPA and the emails.
- `docs/` the official documentation; `notes/` working notes: the audits
  (`notes/audit-<date>.md`, the newest one's register is the issue list),
  `decisions.md`, `ui-contract.md`, `dictionary.md` and the flow notes.
- This is an auth proxy: the attacker's point of view (below) is never skipped.

<!-- rules: begin https://github.com/vbarbarosh/rules 23ee7f914c2d2eedd3008d4725155f0bfdd4cb4f 2026-10-19 -->

## Rules

New code follows the rulebook, https://vbarbarosh.github.io/rules/docs/rules.html
(the repository [vbarbarosh/rules](https://github.com/vbarbarosh/rules), taken at
[`23ee7f9`](https://github.com/vbarbarosh/rules/tree/23ee7f914c2d2eedd3008d4725155f0bfdd4cb4f) on 2026-10-19).
Read the rules that touch your change before you make it, as they stand that
day, for they change. The rule text lives there only; this file names the
groups. Old code stays as it is.

### The rule groups here

Apply:

- **CORE, NAME, VAR, FN, FMT, FLOW, FILE, LINT**: all JavaScript, `src/`,
  `config/`, `tests/`, `db/`, the node scripts in `bin/`, the docs site's
  `.docs/static/*.js` and the script of `design/public_html/spa.html`.
  CommonJS (LINT-07): `require` and `module.exports`, never `import`.
  Read here as: a knex query or a nock interceptor is a builder, its chain
  may span lines (FLOW-05 is for pipelines: `map`, `filter`, `reduce`,
  `replace`); `src/routes/*.js` export their table as `routes`, the shape
  `express_routes` takes (FILE-24); migrations export `up` and `down`.
- **PROJ**: the layout, `bin/` verbs, `data/`, `config/`, the README.
- **GIT**: every commit title.
- **LOG**: `src/services/logger/` and every `logger.write`.
- **SQL**: raw SQL in `knex.raw` (`src/helpers/`, `db/migrations/`); it must
  run on SQLite, MySQL and PostgreSQL alike.
- **CSS-12, CSS-13**: the plain CSS of the SPA and of the docs site
  (`.docs/static/docs.css`).
- **UI, UIM**: the SPA (`design/public_html/spa.html`) and the docs site
  (`bin/build-docs`, `.docs/static/`).
- **DOC-06 to DOC-10**: the audit notes in `notes/`.

Do not apply:

- **VUE**: there is no Vue.
- **CSS-01 to CSS-11**: no utility classes, no Sass, no `#-` local classes.
- **REL**: the release is a Docker image; `bin/release` only bumps and tags.
- **DOC-01 to DOC-05, DOC-11 to DOC-14**: they cover the rules repository's
  own documents.

### Lint

```sh
npx --yes github:vbarbarosh/rules#23ee7f914c2d2eedd3008d4725155f0bfdd4cb4f <the .js files you wrote>
```

The rulebook's linter, at the commit above, over the new code only; old
code is not linted. It exits non-zero on any violation. It reads `.js`
files only: the node scripts in `bin/` without an extension and the SPA's
script are checked by hand (a `.js` copy passes through the same command). Many rules are not linted at all (FMT-27,
FMT-30, FMT-31, FLOW-05, naming): read them.

## How to work

What is expected of an agent: how it does the work, without the author having
to say it each time. Handed to an agent as it is, "work like this". Kept apart
from the rules, which say how the code looks.

- [consequences_first.md](https://github.com/vbarbarosh/rules/blob/23ee7f914c2d2eedd3008d4725155f0bfdd4cb4f/agents/consequences_first.md) — before the first edit, picture what the change leads to, "what if this, what if that"; the entries below follow from it
- [one_example_all_cases.md](https://github.com/vbarbarosh/rules/blob/23ee7f914c2d2eedd3008d4725155f0bfdd4cb4f/agents/one_example_all_cases.md) — one example stands for all cases like it: find them, change them all, say the consequences first
- [every_state_before_done.md](https://github.com/vbarbarosh/rules/blob/23ee7f914c2d2eedd3008d4725155f0bfdd4cb4f/agents/every_state_before_done.md) — a UI is tried in every state (long, empty, one letter, absurd) before it is called done; its layout holds them all; the reply says what was decided and asks what is ambiguous
- [every_point_of_view.md](https://github.com/vbarbarosh/rules/blob/23ee7f914c2d2eedd3008d4725155f0bfdd4cb4f/agents/every_point_of_view.md) — one task is several stories: the user's, the implementation's, the attacker's (and the operator's, the next developer's, the newcomer's); tell each before done; the screen follows the user's story
- [data_as_a_picture.md](https://github.com/vbarbarosh/rules/blob/23ee7f914c2d2eedd3008d4725155f0bfdd4cb4f/agents/data_as_a_picture.md) — a reply that carries data shows it as a picture: ask what the data answers, take the kind of diagram the chooser gives, draw it as its page says, check it; no shape, no picture

- Probably the first thing to do: give a task to a real developer. The first
  thing they do is build, at least in their head, an understanding of the
  consequences. What if this, what if that, and then like so.

### Consequences first

A developer given a task does not start typing. They first picture what the
change leads to: what if this, what if that. Only then do they start, and the
work follows from that picture. An agent works the same way.

![The task, the four "what if" questions asked before the first edit, and what each one shapes: the scope, what is said before the change, the states to test, the stories to tell](https://raw.githubusercontent.com/vbarbarosh/rules/23ee7f914c2d2eedd3008d4725155f0bfdd4cb4f/img/guides/consequences_first.svg)

#### Why

An agent that starts at once changes exactly what was named and stops there.
Whatever follows from the change is left for the author to find: the other
cases built the same way, the states that break the layout, the decision that
needed asking. Thinking first takes a minute. Without it, each consequence
costs the author a message, found one at a time.

#### The rule

1. **Before the first edit, ask "what if".** What else is built like this?
   What does the change touch, slow down, leave stale or break? What happens
   when the data is long, empty, absurd? What does the author not see from
   where they stand?
2. **Let the answers shape the work.** They decide the scope (see
   [One example, all cases](https://github.com/vbarbarosh/rules/blob/23ee7f914c2d2eedd3008d4725155f0bfdd4cb4f/agents/one_example_all_cases.md)), the states to
   test (see [Every state before done](https://github.com/vbarbarosh/rules/blob/23ee7f914c2d2eedd3008d4725155f0bfdd4cb4f/agents/every_state_before_done.md)) and the
   stories to tell (see [Every point of view](https://github.com/vbarbarosh/rules/blob/23ee7f914c2d2eedd3008d4725155f0bfdd4cb4f/agents/every_point_of_view.md)).
3. **Tell the author what was found.** A consequence that makes the change a
   poor one is said before the change, with the better way. What was decided
   along the way is said for information. What is truly ambiguous is asked,
   once, with the options.

- A UI has several dropdowns; each loads its list from the backend every time
  it is opened, and each time shows a lag. I ask the agent: cache it. It
  caches that one request, and skips every other one built the same way. Not
  told, not done: one bolt tightened, while 100-500 components work the same
  way and should move to the cache too.
- The same in everything. Ask to move a button, and it moves exactly that,
  nothing more.
- I may be wrong, and the decision may turn out so-so. So I want an answer
  back first: this will lead to these consequences. Agents rarely look
  ahead like that.
- Unless it was said explicitly that a change concerns one particular case,
  take it in general; understand the idea. "I don't like these buttons, let's
  change their font" means all buttons, everywhere. A style, the way a
  component works, caching: the others must be looked at too.
- I cannot sit and point at every case. That is exactly the machine's work:
  given one concrete example, find all the similar cases in the project.
- Sometimes asking first is right: the project is big, do we really scan
  everything, or make only this local change? Asking to clarify is fine,
  normal.
- Not a rule maybe, a guide: something I give an agent once, "work like
  this", instead of fixing things point by point every time.

### One example, all cases

The author shows one case and means all cases like it. A request that points
at a dropdown, a button or a query names a kind of thing through one
instance of it. The agent's job is to find the rest of that kind, not to fix
the one instance and stop.

This page is meant to be handed to an agent as it is: "work like this".
It is one case of [Consequences first](https://github.com/vbarbarosh/rules/blob/23ee7f914c2d2eedd3008d4725155f0bfdd4cb4f/agents/consequences_first.md).

![The author shows one dropdown that lags: fixing only that one leaves nine lagging; finding every case like it changes all of them, and the one left is named in the reply](https://raw.githubusercontent.com/vbarbarosh/rules/23ee7f914c2d2eedd3008d4725155f0bfdd4cb4f/img/guides/one_example_all_cases.svg)

#### Why

The author sees one case because that is the one in front of them. The
project holds the other hundred, built the same way, with the same flaw.
Fixing only the shown one leaves the project inconsistent: one dropdown is
fast and the rest lag, one button has the new font and the rest the old.
Then the author has to find each remaining case and point at it, one message
each. Finding every case of a pattern is the work a machine does better than
a person; leaving it to the author leaves the agent's work to them.

A change also has consequences the author may not have weighed. A cache
serves stale data after an edit; a moved button may now cover another one or
leave a gap. The author would rather hear that before the change than
discover it after.

#### The rule

1. **An example names a class.** Unless the author says the change is for
   this one case only, it applies to every case like it. "Change the font of
   these buttons" means every button. "Cache this list" means every list
   loaded the same way.
2. **Find the like cases before changing anything.** Search the project for
   the same pattern: the same component, the same kind of request, the same
   style, the same idiom. The example is the way in, not the boundary.
3. **Change them all, or say which stay.** The change goes to every case
   found. A case left as it was is named in the reply, with the reason; none
   is left out silently.
4. **Ask when the sweep is large or the class unclear.** When the like cases
   are many across a big project, or the example could belong to more than
   one class, ask one question that carries what was found: "only this
   dropdown, or all 37 lists that load on open?". Asking to clarify scope is
   expected, not a failure.
5. **Say what the change will cause.** Before making it, name the
   consequences seen: what else moves, breaks or goes stale, and what it
   costs. When a consequence makes the change a poor one, say so first and
   offer the better way; the author decides.

- Another example: a UI done as asked, with nothing checked.
- Why is this alert like this? Why is the close cross at the bottom? It is
  normally at the top right. Why did it jump down? Probably the message is
  too long. Before, the sidebar showed through as well.
- When such a UI is made, can it not be tested in its different states?
  Before saying "done", test it. What if the title is too long? What if
  there is none? What if it is one letter? What if the other parts shown
  have absurd values? What happens in all these cases?
- Then make the layout so that it takes them into account.
- This should go without saying.
- Look at these states and say: here it may be like this, here like that.
  "I made this decision; so this is decided now; I am letting you know."
  "Here I could not decide at all, it is utterly ambiguous; I need a
  confirmation to resolve this conflict." That is how it should be done.
  Any other way wears the author out.

### Every state before done

A piece of UI is not done when it looks right with the one text it was built
with. It is done when it holds with every text and value it will be given.
The agent tries those before saying "done", not the author after.
It is one case of [Consequences first](https://github.com/vbarbarosh/rules/blob/23ee7f914c2d2eedd3008d4725155f0bfdd4cb4f/agents/consequences_first.md).

![the close button pushed under a long alert message](https://raw.githubusercontent.com/vbarbarosh/rules/23ee7f914c2d2eedd3008d4725155f0bfdd4cb4f/agents/every-state-alert.png)

The alert above was built with a short message. A long one took the whole
row, and the close button wrapped to a line of its own, under the text. One
long message in a test would have shown it.

#### Why

The author sees the UI with real data, and real data is never the sample
the agent typed: a name is long, a title is missing, a count is zero or a
million. Each of those breaks a layout made for the sample, and each break
costs the author a screenshot and a message. Trying the states takes the
agent minutes; finding them one by one takes the author days.

![One alert in six states: the sample, too long, missing, tiny, absurd and error; in each the text wraps inside and the close button stays top right](https://raw.githubusercontent.com/vbarbarosh/rules/23ee7f914c2d2eedd3008d4725155f0bfdd4cb4f/img/guides/every_state_before_done.svg)

#### The rule

1. **List the edge cases and the states before calling it done.** The
   element's own states: loading, error, disabled, many at once. Then, for
   every text and value it shows, the edge cases:
   - too long: a title of three lines, a word with no spaces, a path, a URL;
   - missing: empty, `null`, no title at all;
   - tiny: one letter, one item;
   - absurd: zero, negative, a million, a date years away.
2. **Render each one and look.** A screenshot of each state, or one page
   with all of them side by side. A state that was not rendered was not
   tested.
3. **Make the layout hold them.** Fixed parts keep their place: a close
   button stays top right however long the text, a long text wraps or
   ellipsizes inside its own column, an empty one collapses or shows a
   placeholder. Nothing overlaps, nothing is pushed out of view, nothing
   shows through from behind.
4. **Keep the states in a test.** The crowded case goes into the e2e test
   (end to end: a browser opens the real page and acts as the user does),
   with an assertion that nothing overlaps, so the next change does not
   break it again unseen.
5. **Report what each state led to.** The reply names the states rendered,
   with the screenshots, and sorts them in two:
   - **Decided, for your information.** A state with a clear answer is
     handled and said: "a title longer than the row is cut with an ellipsis;
     the full one is in the tooltip".
   - **Ambiguous, needs your confirmation.** A state with no clear answer is
     not guessed at quietly. It is put to the author as one question with
     the options: "an empty title: hide the header, or show 'Untitled'?".

- Every task can be looked at from several sides. One is how it will work.
  Another is the user's: how they will use it. The same app can be looked at
  as its user, as its developer, and as someone who wants to break in, a
  hacker. These are separate stories, two or more parallel views of one
  thing.
- An example of a rule broken: optimistic UI. I answer from the thread, and
  I expect the answer to show at the bottom the same second. What happens:
  something blinks, and it is unclear where it went. Then it appears. Why?
  The message goes to incoming/ and waits for the agent to file it. But it
  already has its Re:, it is an answer to this thread, nothing to think
  about: it must be here. If the agent decides it belongs to another
  subject, the agent opens that subject and links this answer; the answer
  stays here, with a badge like "waiting". Yes, it has to reach incoming/
  for the agent to see it, but that kitchen is not mine to know. From my
  side it must be here at once.
- These stories must be named and written down, the way we have the pairs.
  Add your own suggestions to them. When the app is developed, the
  development is approached from each of these points of view.

### Every point of view

One task is several stories told side by side: how the user uses it, how it
is built, how someone would break it. An agent tells each story before
calling the work done, and the screen follows the user's story, whatever the
implementation does inside.

It is one case of [Consequences first](https://github.com/vbarbarosh/rules/blob/23ee7f914c2d2eedd3008d4725155f0bfdd4cb4f/agents/consequences_first.md).

![Send is pressed: on the left the comment is nowhere for 2 seconds, then it shows; on the right it shows at once marked Sending, and the mark goes when the server has it](https://raw.githubusercontent.com/vbarbarosh/rules/23ee7f914c2d2eedd3008d4725155f0bfdd4cb4f/drafts/optimistic-updates.gif)

Above, a comment sent under a task. In the implementation's story it goes
to the server, waits until it is filed, and comes back with the next
refresh, and that story is right. In the user's story they answered under
this task, and for two seconds the answer is nowhere. Both stories describe
the same click; only one was told while building it.

#### Why

An agent builds from the implementation's story, because that is the one it
writes: files, queues, requests. The user lives in another story, of what
they did and what they see, and the attacker in a third, of what they can
reach. A defect in one story is invisible from the others: a correct queue
is a missing message on screen; a convenient endpoint is an open door. The
author finds each one by living that story, one message each.

#### The points of view

![One task, send a comment, and the stories around it: the user's, the implementation's and the attacker's told by the author; the operator's, the next developer's and the newcomer's suggested by the agent](https://raw.githubusercontent.com/vbarbarosh/rules/23ee7f914c2d2eedd3008d4725155f0bfdd4cb4f/img/guides/every_point_of_view.svg)


Told by the author:

- **User.** What I do, what I see, what I expect next. The screen answers
  my action at once, where I acted; the route inside is not my business.
- **Implementation.** How it works: where data goes, in what order, what
  waits for what, what happens when a step fails.
- **Attacker.** What I can reach, read, change or flood that I should not:
  an input, a URL, a file name, a message that is also an instruction.

Suggested by the agent, for the author to confirm:

- **Operator.** It failed at night and I have the logs and the data folder:
  can I tell what happened, and restart it without losing anything?
- **Next developer.** I open the code a year from now: can I find where this
  lives, read why it is so, and change it without breaking the rest?
- **Newcomer.** I see it the first time, with no context: does the screen
  say what it is, what to do, and what just happened?

#### The rule

1. **Tell each story before the first edit.** One or two lines each, in the
   person's words: "I click, my answer is under the last message". A view
   that does not apply is skipped, not forgotten.
2. **The screen follows the user's story.** When the implementation takes a
   longer way (a queue, an inbox, a second agent), the user still sees the
   result where they acted, at once, marked as pending until the way ends.
   The route stays inside.
3. **Each story gets its test.** The user's story is an e2e test (end to
   end: a browser opens the real page and acts as the user does) of what
   the screen shows and when; the attacker's is a test of what is refused.
4. **Report by story.** The reply says what each view found, and what was
   changed for it, so the author need not read the work through each pair
   of eyes again.

- Tons of text are very hard to read and to understand what stands behind
  them. (2026-10-15 13:28)
- Propose how to use all these diagrams with agents: an instruction for
  agents, so they know how to show data the right way. Which data, with
  what, which diagram for which data. I need to get not text but this kind
  of graphic information, given in graphic form. (2026-10-17 17:50)

### Data as a picture

A reply that carries data shows it as a picture. The author takes in a shape
at a glance, where the same data as a paragraph takes a minute and still
hides how its parts connect. The agent asks what the data answers, picks the
kind of diagram for it, and draws that.

It is one case of [Every point of view](https://github.com/vbarbarosh/rules/blob/23ee7f914c2d2eedd3008d4725155f0bfdd4cb4f/agents/every_point_of_view.md): the
author's story is what they see.

![Six questions about the data, each with the kinds of picture that answer it: how it works, what it is made of, where it stands, what went wrong, how much and how often, what it changes](https://raw.githubusercontent.com/vbarbarosh/rules/23ee7f914c2d2eedd3008d4725155f0bfdd4cb4f/img/guides/data_as_a_picture.svg)

#### Why

An agent thinks in text, so it answers in text: steps as a numbered list,
states as sentences, a plan as paragraphs, numbers in a row. The author has
to rebuild the shape in their head: which step waits on which, where the
failure was, what is done and what is not. A picture hands them the shape
itself. Text that holds data is the author's work left undone.

#### The rule

1. **Find the data in the reply.** Steps, calls, states, parts, links, a
   plan, a failure, numbers over time, a change: anything with a shape.
2. **Ask what it answers,** and take the kind the chooser below gives. Two
   questions, two pictures; never one picture that answers neither well.
3. **Draw that kind as its page says,** on the
   [diagrams page](https://vbarbarosh.github.io/rules/docs/diagrams.html):
   its parts, its colours, when it does not fit.
4. **Picture first, words after.** The reply opens with the outcome in a line,
   then the picture, then a line of what it shows; lists and logs come last.
5. **Check it before it goes:** every text inside its box, nothing on top of
   anything else, every arrow attached, words as big as the text around it,
   the colours of the page it is shown on. A picture that was not looked at
   was not checked.
6. **No shape, no picture.** One fact, a yes or no, a name, a single number:
   a sentence. A code change: its diff.

#### Which picture for which data

- **How does it work?** Steps, calls and decisions:
  [sequence](https://vbarbarosh.github.io/rules/docs/diagrams.html#sequence)
  (who talks to whom, in order),
  [flowchart](https://vbarbarosh.github.io/rules/docs/diagrams.html#flowchart)
  (what is decided where),
  [state](https://vbarbarosh.github.io/rules/docs/diagrams.html#state)
  (what it can be, what moves it),
  [swimlanes](https://vbarbarosh.github.io/rules/docs/diagrams.html#swimlanes)
  (who does each step),
  [pipeline](https://vbarbarosh.github.io/rules/docs/diagrams.html#pipeline)
  (files in, steps, files out),
  [call graph](https://vbarbarosh.github.io/rules/docs/diagrams.html#callgraph)
  (which function calls which).
- **What is it made of, and where does it run?** Parts and links:
  [labelled diagram](https://vbarbarosh.github.io/rules/docs/glossaries.html#MAP-13)
  (one thing and its parts),
  [containers](https://vbarbarosh.github.io/rules/docs/diagrams.html#containers)
  (the parts of a system),
  [cloud](https://vbarbarosh.github.io/rules/docs/diagrams.html#cloud),
  [tiers](https://vbarbarosh.github.io/rules/docs/diagrams.html#tiers),
  [network](https://vbarbarosh.github.io/rules/docs/diagrams.html#network),
  [isometric](https://vbarbarosh.github.io/rules/docs/diagrams.html#isometric)
  (where each part runs),
  [entities](https://vbarbarosh.github.io/rules/docs/diagrams.html#entities)
  (the data and its links),
  [modules](https://vbarbarosh.github.io/rules/docs/diagrams.html#modules)
  and [matrix](https://vbarbarosh.github.io/rules/docs/diagrams.html#matrix)
  (which file or part needs which),
  [data flow](https://vbarbarosh.github.io/rules/docs/diagrams.html#dataflow)
  (where data crosses a trust boundary).
- **Where does it stand?** Progress and plans:
  [milestone](https://vbarbarosh.github.io/rules/docs/diagrams.html#milestone)
  (one goal),
  [kanban](https://vbarbarosh.github.io/rules/docs/diagrams.html#kanban)
  (many pieces of work),
  [plan graph](https://vbarbarosh.github.io/rules/docs/diagrams.html#plangraph)
  (what waits on what),
  [roadmap](https://vbarbarosh.github.io/rules/docs/diagrams.html#roadmap)
  (what is planned when),
  [dashboard](https://vbarbarosh.github.io/rules/docs/diagrams.html#dashboard)
  (many parts at once),
  [versions](https://vbarbarosh.github.io/rules/docs/diagrams.html#versions)
  (which version runs where).
- **What went wrong, and why?** A failure, a log:
  [timeline](https://vbarbarosh.github.io/rules/docs/diagrams.html#timeline)
  (what happened when),
  [cause tree](https://vbarbarosh.github.io/rules/docs/diagrams.html#causetree)
  (why),
  [one case](https://vbarbarosh.github.io/rules/docs/diagrams.html#case)
  (one request, today beside fixed),
  [questions](https://vbarbarosh.github.io/rules/docs/diagrams.html#questions)
  (what is known and what is not),
  [waterfall](https://vbarbarosh.github.io/rules/docs/diagrams.html#waterfall)
  (where one request spends its time).
- **How much, how often?** Numbers:
  [line chart](https://vbarbarosh.github.io/rules/docs/diagrams.html#linechart)
  (over time),
  [heatmap](https://vbarbarosh.github.io/rules/docs/diagrams.html#heatmap)
  (which days and hours),
  [sankey](https://vbarbarosh.github.io/rules/docs/diagrams.html#sankey)
  (where it goes, how much),
  [service map](https://vbarbarosh.github.io/rules/docs/diagrams.html#servicemap)
  (what talks to what, live),
  [flame](https://vbarbarosh.github.io/rules/docs/diagrams.html#flame) and
  [treemap](https://vbarbarosh.github.io/rules/docs/diagrams.html#treemap)
  (where the time or the size goes).
- **What does it change, and what first?**
  [screen](https://vbarbarosh.github.io/rules/docs/diagrams.html#screen)
  (where on the screen), screenshots before and after (what the author
  sees),
  [change map](https://vbarbarosh.github.io/rules/docs/diagrams.html#changemap)
  (which files),
  [quadrant](https://vbarbarosh.github.io/rules/docs/diagrams.html#quadrant)
  (what to do first).

<!-- rules: end -->
