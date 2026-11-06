import "./ui-helpers";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import MatchEditor from "../components/admin/MatchEditor";
import type { MatchRecord } from "../lib/match";
import { newMatchInput } from "../lib/match";
import type { Team } from "../lib/repo/teams";
import { fakeFetch } from "./ui-helpers";

const T1 = "11111111-1111-4111-8111-111111111111";
const T2 = "22222222-2222-4222-8222-222222222222";
const teams: Team[] = [
  { id: T1, name: "Titan Spikers", shortName: "TTN", logoUrl: "", info: "" },
  { id: T2, name: "Vortex Spikers", shortName: "VTX", logoUrl: "", info: "" },
];

const record = (patch: Partial<MatchRecord> = {}): MatchRecord => ({
  ...newMatchInput(T1, T2), status: "live", currentSet: { type: "Mixed", home: 10, away: 8 }, stage: "Semi-final",
  id: "33333333-3333-4333-8333-333333333333", version: 1, updatedAt: "2026-11-05T10:00:00.000Z", updatedByName: "Ada", ...patch,
});

const editor = (role: "admin" | "scorekeeper" = "admin", match = record()) =>
  render(<MatchEditor initial={match} teams={teams} role={role} setTypes={["Mixed"]} />);
const saveButton = () => screen.getByRole("button", { name: /^(save changes|saving)/i }) as HTMLButtonElement;

describe("match editor: conflicting edits", () => {
  const newer = record({ version: 2, updatedByName: "Sam", currentSet: { type: "Mixed", home: 14, away: 8 } });

  it("detects a newer save, lists the differences, and does not overwrite", async () => {
    const calls = fakeFetch(({ method }) => (method === "PUT" ? { status: 409, body: { code: "conflict", error: "stale", match: newer } } : {}));
    editor();
    fireEvent.click(screen.getByRole("button", { name: /add a point to titan spikers/i })); // mine: 11
    fireEvent.click(saveButton());

    const alert = await screen.findByText(/newer data has been saved by sam/i);
    const panel = alert.closest("[role=alert]") as HTMLElement;
    assert.ok(within(panel).getByText(/current set: yours 11–8, saved 14–8/i));
    assert.equal(calls.filter((c) => c.method === "PUT").length, 1);
  });

  it("'load the latest' replaces my draft with the saved data", async () => {
    fakeFetch(({ method }) => (method === "PUT" ? { status: 409, body: { code: "conflict", match: newer } } : {}));
    editor();
    fireEvent.click(screen.getByRole("button", { name: /add a point to titan spikers/i }));
    fireEvent.click(saveButton());
    fireEvent.click(await screen.findByRole("button", { name: /load the latest and discard my edits/i }));
    assert.equal((screen.getByLabelText("Titan Spikers score") as HTMLInputElement).value, "14");
    assert.ok(screen.getByText("All changes saved."));
  });

  it("'keep my edits' re-bases onto the newer version so the next save is a deliberate overwrite", async () => {
    let attempt = 0;
    const calls = fakeFetch(({ method }) => {
      if (method !== "PUT") return {};
      attempt += 1;
      return attempt === 1 ? { status: 409, body: { code: "conflict", match: newer } } : { body: { match: record({ version: 3 }) } };
    });
    editor();
    fireEvent.click(screen.getByRole("button", { name: /add a point to titan spikers/i }));
    fireEvent.click(saveButton());
    fireEvent.click(await screen.findByRole("button", { name: /keep my edits and review/i }));
    assert.ok(screen.getByText(/your edits are kept\. save again to overwrite/i));
    assert.equal((screen.getByLabelText("Titan Spikers score") as HTMLInputElement).value, "11");

    fireEvent.click(saveButton());
    await waitFor(() => assert.equal(calls.filter((c) => c.method === "PUT").length, 2));
    assert.equal((calls.filter((c) => c.method === "PUT")[1].body as { version: number }).version, 2);
  });
});
