# The teaching model

*How this app teaches, and the discipline the AI teaches under.*

---

## 1. The working mental model

Four things, and the order matters.

**A curriculum is a spine, not a syllabus.** `curricula → curriculum_levels → curriculum_subjects → topics`.
A level is a grade *plus a stream*, because from the second Egyptian secondary year two children in the same grade
study different subjects, and a model that knows only "grade 11" will teach the wrong one. A topic knows its unit,
and the unit is part of the lesson's meaning: the same six words mean a different lesson in Prep 1 algebra than in
Grade 11 pure mathematics.

**A lesson is generated, not stored.** Nothing in the database is a lesson until a child asks for one. What is
stored is the *spine* and then the *cache*: a lesson written once per topic, level and language, and reused by
everybody after. This is why the curriculum is the asset — it is the index the cache is keyed on.

**Depth is the product, not the subject.** Every topic exists at two depths over the same syllabus point. The
basics are free for anyone, everywhere, because a child who cannot follow his class should never meet a price.
The deeper version, and the teacher who performs it, are what a family buys.

**The child, not the lesson, is the unit of success.** A lesson that was read is worth nothing; a homework
question attempted is worth something. Every design decision resolves against that, which is why the attempt is
delegated to the child and never to the model.

---

## 2. Why the four dimensions, here

This app has an AI write lessons a child reads alone, at night, with nobody watching. That is the highest-stakes
use of a model in the product, and until now it ran on one paragraph of instruction and no verification at all —
`topic_flags`, the only place a wrong lesson could be caught, has never held a single row.

So the four dimensions are not a framing device here. Each one names a failure this app already has.

### Delegation — deciding what not to hand over

The rule: **the model may explain and may drill. It may not decide what a child has understood, and it may not be
the only thing between a wrong fact and a child.**

| Task | Who | Why there |
|---|---|---|
| Explain the topic | model | Repeatable work over a fixed syllabus; a parent has no time for it |
| Attempt the questions | **child** | A lesson only watched teaches nothing |
| Write practice questions | model | Volume is the model's strength, and a bad question costs a minute |
| Judge whether it matched the class | **parent** | Only someone who sees the school's materials can tell |
| Diagnose a misunderstanding that survived two explanations | **human** | Repeating an explanation louder is what a model does when it cannot tell why a child is stuck |

The last row is the important one. It is also the honest basis for charging: what a family pays for is the point
where a model stops being the right tool.

### Description — telling it the thing, the way and the standard

A brief is built from the curriculum row, not the grade:

- **Product** — this topic, this unit, this grade, this stream, this curriculum, at this depth.
- **Process** — in the language the subject is taught in; inside the unit, because the child has not met the
  later ones; every example worked to its last line, since the step called "obvious" is the step he is stuck on.
- **Performance** — good means he can attempt tonight's homework unaided; and where you are not certain,
  **say so in one plain sentence rather than writing something plausible.** An admission costs a child nothing.
  An invention costs him the exam question.

### Discernment — checking before a child reads it

Checks are generated per topic and level, and each is answerable yes or no. Blocking checks never reach a child;
warnings reach the child and the parent's queue together.

`on_topic` · `language` · `grade_fit` · `worked_example` · `no_invention` — blocking.
`attemptable` — warning. At depth, `says_why` blocks and `names_trap` warns.

One rule carries the weight: **a check that did not run counts as failed.** Silence is not a pass. That is the
lesson of the `u is not a function` hunt, where a check that quietly returned "not stale" sent four people
chasing a bug that did not exist.

### Diligence — what is recorded and disclosed

Every lesson carries its provenance: that a model wrote it, which model, when it was checked, and which checks it
failed. The child is told in the language he is reading, and told differently once a parent has confirmed it
matched the class. Disclosure a child cannot read is not disclosure.

Recording the model matters for one practical reason: when a lesson turns out to be wrong, the question is never
about that lesson. It is which *other* lessons came out of the same batch.

---

## 3. What is built, and what is not

Built: the curriculum spine for both systems; `lib/teaching/fluency.ts` holding all four dimensions as typed,
tested functions over a real topic row.

Not yet built: running `checks()` against generated lessons in the writing pipeline, and surfacing warnings in the
parent's review queue. The contract exists before the enforcement on purpose — an enforcement written first tends
to be whatever was easy to check, rather than what matters.

---

*A model that will not say "I am not sure" is not a teacher. It is a confident stranger.*
