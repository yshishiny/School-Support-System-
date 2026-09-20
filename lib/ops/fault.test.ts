import { describe as group, expect, it, vi } from "vitest";

vi.mock("./log", () => ({ logError: vi.fn(async () => {}) }));

import { Fault, act, attempt, dbCheck, dbRow, describe, fault, isFault, newRef, refuse } from "./fault";
import { logError } from "./log";

const logged = logError as unknown as ReturnType<typeof vi.fn>;

group("the reference a person reads out", () => {
  it("avoids characters that are misread", () => {
    for (let i = 0; i < 200; i += 1) expect(newRef()).toMatch(/^[23456789abcdefghjkmnpqrstuvwxyz]{6}$/);
  });

  it("is different every time, so two failures never look like one", () => {
    const seen = new Set(Array.from({ length: 500 }, () => newRef()));
    expect(seen.size).toBeGreaterThan(495);
  });
});

group("opening up whatever was thrown", () => {
  it("turns a Postgres code into a sentence and keeps the code", () => {
    const d = describe({ code: "23505", message: 'duplicate key value violates unique constraint "kpi_ticks_pkey"', details: "Key (student_id)=(x) already exists.", hint: null });
    expect(d.message).toBe("That is already saved.");
    expect(d.code).toBe("23505");
    expect(d.detail).toContain("duplicate key");
    expect(d.detail).toContain("already exists");
  });

  it("says plainly when a row was refused by its permissions", () => {
    expect(describe({ code: "42501", message: "new row violates row-level security policy" }).message).toBe("You are not allowed to do that.");
  });

  it("keeps the original words for a code it does not know", () => {
    expect(describe({ code: "XX999", message: "something odd" }).message).toBe("something odd");
  });

  it("reads an ordinary Error", () => {
    const d = describe(new Error("the model refused"));
    expect(d.message).toBe("the model refused");
    expect(d.detail).toContain("the model refused");
  });

  it("survives a string, a null and an object nobody expected", () => {
    expect(describe("plain").message).toBe("plain");
    expect(describe(null).message).toBe("Something went wrong.");
    expect(describe({ odd: 1 }).message).toBe("Something went wrong.");
  });
});

group("refusal against fault", () => {
  it("a refusal shows the sentence alone: it is the app working, not breaking", () => {
    const r = refuse("Pick a plan.");
    expect(r.expected).toBe(true);
    expect(r.display).toBe("Pick a plan.");
  });

  it("a fault shows the sentence and the reference to look it up by", () => {
    const f = fault("actions.snaps.review", { user: "Could not save that." });
    expect(f.expected).toBe(false);
    expect(f.display).toBe(`Could not save that. (ref ${f.ref})`);
    expect(f.where).toBe("actions.snaps.review");
  });

  it("borrows the cause's words when nobody wrote a friendlier sentence", () => {
    expect(fault("ai.lesson", { cause: new Error("upstream timed out") }).user).toBe("upstream timed out");
  });

  it("is recognisable after being thrown and caught", () => {
    try {
      throw fault("x.y");
    } catch (e) {
      expect(isFault(e)).toBe(true);
    }
  });
});

group("a checked database result", () => {
  it("hands back the rows when it worked", () => {
    expect(dbCheck("actions.rewards.add", { data: [{ id: "1" }], error: null })).toEqual([{ id: "1" }]);
  });

  it("throws a located fault instead of leaking the constraint name", () => {
    let caught: Fault | null = null;
    try {
      dbCheck("actions.rewards.add", { data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "rewards_pkey"' } });
    } catch (e) {
      caught = e as Fault;
    }
    expect(caught?.where).toBe("actions.rewards.add");
    expect(caught?.user).toBe("That is already saved.");
    expect(caught?.code).toBe("23505");
    // The raw text is kept for the log, but is not what the child reads.
    expect(caught?.detail).toContain("rewards_pkey");
    expect(caught?.display).not.toContain("rewards_pkey");
  });

  it("lets the caller say something kinder for that one spot", () => {
    try {
      dbCheck("actions.wallet.spend", { data: null, error: { code: "23514", message: "check constraint" } }, "That amount is more than you have.");
    } catch (e) {
      expect((e as Fault).user).toBe("That amount is more than you have.");
    }
  });

  it("treats a missing row as a failure when one was required", () => {
    expect(() => dbRow("actions.allowance.claim", { data: null, error: null })).toThrow();
    expect(dbRow("actions.allowance.claim", { data: { id: "w1" }, error: null })).toEqual({ id: "w1" });
  });
});

group("the boundary around a server action", () => {
  it("passes a success straight through", async () => {
    logged.mockClear();
    expect(await act("actions.x", async () => ({ ok: "done" }))).toEqual({ ok: "done" });
    expect(logged).not.toHaveBeenCalled();
  });

  it("returns a refusal without logging it: nothing broke", async () => {
    logged.mockClear();
    expect(await act("actions.x", async () => { throw refuse("Title is required."); })).toEqual({ error: "Title is required." });
    expect(logged).not.toHaveBeenCalled();
  });

  it("logs a fault under the function it happened in and gives the person the reference", async () => {
    logged.mockClear();
    const r = await act("actions.assignments.add", async () => {
      throw fault("actions.assignments.add", { user: "Could not save the homework.", cause: { code: "23503", message: "fk" } });
    }) as { error: string; ref: string };
    expect(r.error).toBe(`Could not save the homework. (ref ${r.ref})`);
    expect(logged).toHaveBeenCalledOnce();
    const [area, , ctx] = logged.mock.calls[0];
    expect(area).toBe("actions.assignments.add");
    expect(ctx.ref).toBe(r.ref);
    expect(ctx.meta.code).toBe("23503");
  });

  it("locates a plain throw that never heard of Fault", async () => {
    logged.mockClear();
    const r = await act("actions.teach.start", async () => { throw new TypeError("u is not a function"); }) as { error: string; ref: string };
    expect(logged.mock.calls[0][0]).toBe("actions.teach.start");
    expect(r.error).toContain("u is not a function");
    expect(r.ref).toHaveLength(6);
  });
});

group("work that must not take the caller down", () => {
  it("gives back the fallback and leaves a line in the log", async () => {
    logged.mockClear();
    expect(await attempt("prayers.mosqueBonus", async () => { throw new Error("network"); }, 0)).toBe(0);
    expect(logged).toHaveBeenCalledOnce();
    expect(logged.mock.calls[0][0]).toBe("prayers.mosqueBonus");
  });

  it("stays out of the way when the work succeeds", async () => {
    logged.mockClear();
    expect(await attempt("prayers.mosqueBonus", async () => 20, 0)).toBe(20);
    expect(logged).not.toHaveBeenCalled();
  });
});

group("the reference a person quotes", () => {
  it("is found in the sentence the action handed back", async () => {
    const { refOf, withoutRef } = await import("@/lib/client-action");
    const f = fault("actions.wallet.spend", { user: "Could not save that." });
    expect(refOf(f.display)).toBe(f.ref);
    expect(withoutRef(f.display)).toBe("Could not save that.");
  });

  it("is absent from a refusal, because there is nothing to look up", async () => {
    const { refOf } = await import("@/lib/client-action");
    expect(refOf(refuse("Pick a plan.").display)).toBeNull();
    expect(refOf(null)).toBeNull();
  });
});

group("the database codes, as the real server emits them", () => {
  // Each of these was provoked on the live database and its SQLSTATE read back, so the table is pinned to
  // what Postgres actually sends rather than to what it is remembered as sending.
  const real: [string, string, string][] = [
    ["23505", 'duplicate key value violates unique constraint "probe_p_pkey"', "That is already saved."],
    ["23502", 'null value in column "name" of relation "probe_p" violates not-null constraint', "Something required was left empty."],
    ["23514", 'new row for relation "probe_p" violates check constraint "probe_p_n_check"', "That value is not allowed here."],
    ["22001", "value too long for type character varying(3)", "That is too long."],
    ["23503", 'insert or update on table "probe_c" violates foreign key constraint', "Something this belongs to is missing."],
    ["22P02", 'invalid input syntax for type uuid: "not-a-uuid"', "That value is in the wrong format."],
    ["42P01", 'relation "table_that_is_not_there" does not exist', "The app looked for something that is not in the database."],
    ["42501", 'new row violates row-level security policy for table "points_ledger"', "You are not allowed to do that."],
  ];
  for (const [code, message, plain] of real) {
    it(`${code} reads as “${plain}”`, () => {
      const d = describe({ code, message, details: null, hint: null });
      expect(d.message).toBe(plain);
      expect(d.code).toBe(code);
      expect(d.detail).toContain(message.slice(0, 20));
    });
  }
});
