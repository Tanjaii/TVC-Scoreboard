import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatClock, formatWhen } from "../lib/format";
import { fromLagosWall, toLagosWall } from "../lib/time";

describe("Lagos time", () => {
  // 14:00 UTC is 3:00 PM in Lagos (UTC+1). A server running in UTC used to print 2:00 PM, an hour behind.
  const iso = "2026-11-20T14:00:00.000Z";

  it("formats match times in Lagos time whatever timezone the server or device uses", () => {
    assert.match(formatWhen(iso), /Fri,? 20 Nov,? 3:00 pm/i);
    assert.match(formatClock(iso), /^3:00 pm$/i);
  });

  it("converts to and from the Lagos wall clock without drifting", () => {
    const wall = toLagosWall(iso);
    assert.equal(wall.getUTCHours(), 15);
    assert.equal(fromLagosWall(wall), iso);
  });
});
