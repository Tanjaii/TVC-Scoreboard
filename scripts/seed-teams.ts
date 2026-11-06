import { getDb } from "../lib/db";

// Optional starter teams, taken from the logo files you supplied. Edit names, short names and info in Admin > Teams.
const starters = [
  { name: "Aardvark", shortName: "AAR", logoUrl: "/assets/aardvark-logo.jpeg" },
  { name: "Breeze Spikers", shortName: "BRZ", logoUrl: "/assets/breeze-spikers-logo.jpeg" },
  { name: "Titan Spikers", shortName: "TTN", logoUrl: "/assets/titan-spikers-logo.jpeg" },
  { name: "Vortex Spikers", shortName: "VTX", logoUrl: "/assets/vortex-spikers-logo.jpeg" },
];
const db = getDb();
for (const t of starters) {
  await db.query(
    "insert into teams (name, short_name, logo_url) values ($1, $2, $3) on conflict ((lower(name))) do nothing",
    [t.name, t.shortName, t.logoUrl],
  );
}
console.log(`Ensured ${starters.length} starter teams exist.`);
process.exit(0);
