import "./ui-helpers";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import MatchEditor from "../components/admin/MatchEditor";
import DateTimePicker from "../components/admin/DateTimePicker";
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

describe("match editor: roles", () => {
  it("scorekeepers can score but setup and history are locked", () => {
    fakeFetch(() => ({}));
    editor("scorekeeper", record({ sets: [{ type: "Men", home: 25, away: 20 }] }));
    assert.equal((screen.getByLabelText(/^home team$/i) as HTMLButtonElement).disabled, true);
    assert.equal((screen.getByLabelText(/^status$/i) as HTMLButtonElement).disabled, true);
    assert.equal((screen.getByLabelText("Set 1 type") as HTMLInputElement).disabled, true);
    assert.equal(screen.queryByRole("button", { name: /add completed set/i }), null);
    assert.equal(screen.queryByRole("button", { name: /^remove$/i }), null);
    assert.equal((screen.getByLabelText(/set type/i) as HTMLInputElement).disabled, false);
    fireEvent.click(screen.getByRole("button", { name: /add a point to vortex spikers/i }));
    assert.equal(saveButton().disabled, false);
  });

  it("admins can add completed sets with their own set type", () => {
    fakeFetch(() => ({}));
    editor("admin");
    fireEvent.click(screen.getByRole("button", { name: /add completed set/i }));
    fireEvent.change(screen.getByLabelText("Set 1 type"), { target: { value: "Ladies only" } });
    assert.equal((screen.getByLabelText("Set 1 type") as HTMLInputElement).value, "Ladies only");
    assert.ok(screen.getByText(/unsaved changes/i));
  });

  it("admins can enter results for a scheduled old match and save it as completed", async () => {
    const scheduled = record({ status: "scheduled", currentSet: null, sets: [] });
    const calls = fakeFetch(({ method, body }) => method === "PUT"
      ? { body: { match: { ...scheduled, ...(body as { match: object }).match, version: 2 } } }
      : {});
    editor("admin", scheduled);

    fireEvent.click(screen.getByRole("button", { name: "Enter set results" }));
    fireEvent.change(screen.getByLabelText("Set 1 Titan Spikers score"), { target: { value: "25" } });
    fireEvent.change(screen.getByLabelText("Set 1 Vortex Spikers score"), { target: { value: "21" } });
    assert.ok(screen.getByLabelText("Set 1 Titan Spikers score"));
    fireEvent.click(saveButton());

    await screen.findByText(/saved at .*visitors now see this version/i);
    assert.equal(calls.filter((call) => call.method === "PUT").length, 1);
    const payload = calls.find((call) => call.method === "PUT")?.body as { match: MatchRecord };
    assert.equal(payload.match.status, "completed");
    assert.deepEqual(payload.match.sets, [{ type: "", home: 25, away: 21 }]);
  });

  it("admins see setup controls enabled and scorekeeper controls are disabled", () => {
    fakeFetch(() => ({}));
    editor("admin");
    // admins can change status and home team
    assert.equal((screen.getByLabelText(/^status$/i) as HTMLButtonElement).disabled, false);
    assert.equal((screen.getByLabelText(/^home team$/i) as HTMLButtonElement).disabled, false);
    // save starts disabled
    assert.equal(saveButton().disabled, true);
  });

  it("supports custom stage entry through the floating dropdown", () => {
    fakeFetch(() => ({}));
    editor();
    fireEvent.click(screen.getByRole("button", { name: "Stage" }));
    fireEvent.change(screen.getByLabelText("Custom stage"), { target: { value: "Opening round" } });
    fireEvent.click(screen.getByRole("button", { name: "Use" }));
    assert.equal((screen.getByRole("button", { name: "Stage" }) as HTMLButtonElement).textContent?.includes("Opening round"), true);
    assert.equal(saveButton().disabled, false);
  });

  it("commits date-picker selections as ISO values", () => {
    let updated: string | null = null;
    render(<DateTimePicker label="Scheduled start" value="2026-12-10T00:00:00.000Z" onChange={(value) => { updated = value; }} />);
    fireEvent.click(screen.getByRole("button", { name: "Scheduled start" }));
    fireEvent.click(screen.getByRole("button", { name: "PM" }));
    assert.match(updated ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
