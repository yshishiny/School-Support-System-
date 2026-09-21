import { describe, expect, it } from "vitest";
import { emailProblem, isPlaceholderEmail, may, passwordProblem, type Actor, type Subject, type World } from "./rights";

const FAM = "fam-1";
const OTHER = "fam-2";
const world: World = { admins: 2, parentsInFamily: 2 };

const owner: Actor = { id: "owner", familyId: FAM, role: "parent", isAdmin: false, isFamilyOwner: true };
const otherParent: Actor = { id: "mum", familyId: FAM, role: "parent", isAdmin: false, isFamilyOwner: false };
const admin: Actor = { id: "root", familyId: OTHER, role: "parent", isAdmin: true, isFamilyOwner: true };
const child: Actor = { id: "kid", familyId: FAM, role: "student", isAdmin: false, isFamilyOwner: false };

const sub = (over: Partial<Subject> = {}): Subject =>
  ({ id: "kid", familyId: FAM, role: "student", isAdmin: false, isFamilyOwner: false, disabled: false, ...over });

const why = (v: ReturnType<typeof may>) => (v.ok ? null : v.why);

describe("a child administers nobody", () => {
  it("cannot touch another account through this door", () => {
    expect(why(may(child, sub({ id: "sibling" }), "reset_password", world))).toBe("Only a parent can administer accounts.");
  });
  it("cannot reset his own password here either — that path needs the current one", () => {
    expect(may(child, sub({ id: "kid" }), "reset_password", world).ok).toBe(false);
  });
});

describe("families are sealed", () => {
  it("keeps a parent out of another family", () => {
    expect(why(may(owner, sub({ familyId: OTHER }), "reset_password", world))).toBe("That account belongs to another family.");
  });
  it("lets a system administrator across", () => {
    expect(may(admin, sub({ familyId: FAM }), "reset_password", world).ok).toBe(true);
  });
});

describe("inside a family", () => {
  it("lets any parent administer a child", () => {
    expect(may(otherParent, sub(), "reset_password", world).ok).toBe(true);
  });
  it("stops a second parent administering the other parent", () => {
    expect(why(may(otherParent, sub({ id: "owner", role: "parent", isFamilyOwner: true }), "reset_password", world)))
      .toBe("Only the main parent can administer another parent's account.");
  });
  it("lets the main parent administer another parent", () => {
    expect(may(owner, sub({ id: "mum", role: "parent" }), "reset_password", world).ok).toBe(true);
  });
});

describe("nobody acts on themselves through the admin door", () => {
  it("sends you to your own page for your own password", () => {
    expect(why(may(owner, sub({ id: "owner", role: "parent", isFamilyOwner: true }), "reset_password", world)))
      .toBe("Change your own password on your account page, with your current one.");
  });
  it("refuses self-disable, which nobody else may be able to undo", () => {
    expect(why(may(owner, sub({ id: "owner", role: "parent", isFamilyOwner: true }), "disable", world)))
      .toBe("You cannot disable your own account.");
  });
  it("refuses self-demotion", () => {
    expect(why(may(admin, sub({ id: "root", familyId: OTHER, role: "parent", isAdmin: true, isFamilyOwner: true }), "revoke_admin", world)))
      .toBe("You cannot remove your own administrator rights.");
  });
});

describe("the last one of anything is protected", () => {
  it("will not disable the last administrator", () => {
    expect(why(may(admin, sub({ id: "other-admin", role: "parent", isAdmin: true }), "disable", { ...world, admins: 1 })))
      .toBe("That is the last administrator.");
  });
  it("will not strip the last administrator", () => {
    expect(why(may(admin, sub({ id: "other-admin", role: "parent", isAdmin: true }), "revoke_admin", { ...world, admins: 1 })))
      .toBe("That is the last administrator.");
  });
  it("will not disable a family's owner until ownership has moved", () => {
    expect(why(may(admin, sub({ role: "parent", isFamilyOwner: true }), "disable", world)))
      .toBe("Move ownership to another parent first.");
  });
  it("will not hand ownership over when there is nobody to hand it to", () => {
    expect(why(may(owner, sub({ id: "mum", role: "parent" }), "transfer_ownership", { ...world, parentsInFamily: 1 })))
      .toBe("There is no other parent to hand over to.");
  });
});

describe("administrator rights", () => {
  it("are handed out only by an administrator, never by a family owner", () => {
    expect(why(may(owner, sub({ id: "mum", role: "parent" }), "grant_admin", world)))
      .toBe("Only an administrator can grant administrator rights.");
    expect(may(admin, sub({ id: "mum", role: "parent" }), "grant_admin", world).ok).toBe(true);
  });
  it("are never given to a child", () => {
    expect(why(may(admin, sub(), "grant_admin", world))).toBe("Only a parent can be an administrator.");
  });
});

describe("enable", () => {
  it("is refused on an account that is already on", () => {
    expect(why(may(owner, sub(), "enable", world))).toBe("That account is already active.");
  });
  it("is allowed on a disabled one", () => {
    expect(may(owner, sub({ disabled: true }), "enable", world).ok).toBe(true);
  });
});

describe("passwordProblem", () => {
  it("asks for something long enough to matter", () => {
    expect(passwordProblem("short")).toBe("Use at least 8 characters.");
    expect(passwordProblem("longenough")).toBeNull();
  });
  it("catches the mismatch before the server does", () => {
    expect(passwordProblem("longenough", "longenoug")).toBe("The two passwords do not match.");
    expect(passwordProblem("longenough", "longenough")).toBeNull();
  });
  it("refuses a surrounding space, which is invisible and unrepeatable", () => {
    expect(passwordProblem(" longenough")).toBe("It cannot start or end with a space.");
    expect(passwordProblem("longenough ")).toBe("It cannot start or end with a space.");
  });
});

describe("emailProblem", () => {
  it("accepts a real address", () => expect(emailProblem("omar@gmail.com", "study.local")).toBeNull());
  it("rejects nonsense", () => expect(emailProblem("omar", "study.local")).toContain("does not look like"));
  it("rejects the stand-in domain the app invents for children", () => {
    expect(emailProblem("omar@study.local", "study.local")).toContain("stand-in");
    expect(emailProblem("omar@STUDY.LOCAL", "study.local")).toContain("stand-in");
  });
});

describe("isPlaceholderEmail", () => {
  it("knows a made-up address from a real one", () => {
    expect(isPlaceholderEmail("youssef@study.local", "study.local")).toBe(true);
    expect(isPlaceholderEmail("shishiny@gmail.com", "study.local")).toBe(false);
    expect(isPlaceholderEmail(null, "study.local")).toBe(false);
  });
});
