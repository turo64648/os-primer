# How to Use This Primer

This primer is meant to be studied over a few weeks, not skimmed the night before. Each chapter builds a mental
model from first principles, then connects it to real systems and to the questions interviewers actually ask.

## What's in each chapter

- **Core explanation.** The concepts in order, each building on the last. Read this part carefully.
- **Diagrams and interactive widgets.** Where watching something move makes it click, there is a widget to play with.
- **C examples.** Short programs you can compile and run on any Linux machine (`gcc -O2 file.c && ./a.out`).
- **Why it matters in real systems.** How the concept shows up in databases, web servers, language runtimes and
  ML infrastructure. Senior interviews live here.
- **Interview questions.** From basic to senior-level follow-ups, each with a model answer. Try to answer out
  loud before opening it.
- **Misconceptions.** Things that sound right but aren't, and are common in interviews.
- **Flashcards and a quiz.** For review in a few days' time.

## A suggested routine

1. Read a chapter in one sitting, running the code and playing with the widgets.
2. The next day, do the flashcards and quiz without re-reading.
3. Answer the interview questions **out loud**, as if to an interviewer, and only then compare with the model answer.
4. A week later, redo the flashcards. Mark the chapter as done once they feel easy.

Your progress (chapters done, known flashcards, best quiz scores) is saved in this browser only.

## How interviewers use OS questions

At senior level, OS questions rarely stop at definitions. Expect a chain like:

> "What's virtual memory?" → "What happens on a TLB miss?" → "Your service's p99 latency doubled after moving to
> bigger machines. Could memory management be involved? How would you check?"

So for every concept, aim to be able to explain **what it is**, **what it costs**, and **when it becomes a
problem in production**.
