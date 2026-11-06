import "./ui-helpers";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

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

describe("match editor: drafts stay private until saved", () => {
  it("starts clean; editing makes an unsaved draft and sends nothing to the server", () => {
    const calls = fakeFetch(() => ({}));
    editor();
    assert.equal(saveButton().disabled, true);
    assert.ok(screen.getByText("All changes saved."));

    fireEvent.click(screen.getByRole("button", { name: /add a point to titan spikers/i }));
    assert.ok(screen.getByText(/unsaved changes\. visitors can’t see them yet/i));
    assert.equal(saveButton().disabled, false);
    assert.equal(calls.length, 0, "no request until Save is pressed");
  });

  it("saves with the version it was based on, then shows the saved state", async () => {
    const calls = fakeFetch(({ method, body }) =>
      method === "PUT"
        ? { body: { match: record({ version: 2, currentSet: (body as { match: { currentSet: object } }).match.currentSet as never }) } }
        : {});
    editor();
    fireEvent.click(screen.getByRole("button", { name: /add a point to titan spikers/i }));
    fireEvent.click(saveButton());

    await waitFor(() => assert.ok(screen.getByText(/saved at .*visitors now see this version/i)));
    const put = calls.find((c) => c.method === "PUT")!;
    assert.equal((put.body as { version: number }).version, 1);
    assert.equal((put.body as { match: { currentSet: { home: number } } }).match.currentSet.home, 11);
    assert.ok(screen.getByText("All changes saved."));
    assert.ok(screen.getByText(/saved version 2/i));
  });

  it("discard returns to the saved values", () => {
    fakeFetch(() => ({}));
    editor();
    fireEvent.click(screen.getByRole("button", { name: /add a point to titan spikers/i }));
    fireEvent.click(screen.getByRole("button", { name: /discard changes/i }));
    assert.ok(screen.getByText("All changes saved."));
    assert.equal((screen.getByLabelText("Titan Spikers score") as HTMLInputElement).value, "10");
  });

  it("broadcast is a draft change that only applies on save", () => {
    const calls = fakeFetch(() => ({}));
    editor();
    fireEvent.click(screen.getByRole("checkbox", { name: /broadcast on the public scoreboard/i }));
    assert.ok(screen.getByText(/applied when you press save changes/i));
    assert.equal(calls.length, 0);
  });
});
