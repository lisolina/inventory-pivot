import { useState, useMemo } from "react";

const NAVY = "#1B2A4A";
const GOLD = "#C9A84C";
const CREAM = "#FFF9E6";
const SLATE = "#3D4F6F";
const RED = "#C0392B";
const GREEN = "#27AE60";
const BLUE = "#2980B9";
const ORANGE = "#E67E22";

const GRAMS_PER_LB = 453.59237;

interface Ingredient {
  id: string;
  name: string;
  pctByWeight: number;
}

interface Recipe {
  fillWeightG: number;
  overagePct: number;
  ingredients: Ingredient[];
}

interface Supplier {
  id: string;
  name: string;
  prices: Record<string, number>;
  freightPerLb: number;
  freightNote: string;
  selected: Record<string, boolean>;
  notes: string;
}

const defaultRecipe: Recipe = {
  fillWeightG: 23,
  overagePct: 2.35,
  ingredients: [
    { id: "garlic", name: "Minced Garlic (Toasted)", pctByWeight: 65.0 },
    { id: "parsley", name: "Dried Parsley Flakes", pctByWeight: 15.33 },
    { id: "salt", name: "Sea Salt / Kosher Salt", pctByWeight: 11.67 },
    { id: "chili", name: "Chili Flakes", pctByWeight: 8.0 },
  ],
};

const defaultSuppliers: Supplier[] = [
  {
    id: "kalustyan", name: "Kalustyan's",
    prices: { garlic: 5.99, parsley: 9.99, salt: 0, chili: 5.99 },
    freightPerLb: 0.224,
    freightNote: "$220 / 982 lbs",
    selected: { garlic: true, parsley: true, salt: false, chili: true },
    notes: "Current primary",
  },
  {
    id: "saltworks", name: "SaltWorks",
    prices: { garlic: 0, parsley: 0, salt: 3.38, chili: 0 },
    freightPerLb: 0.929,
    freightNote: "$111.46 / 120 lbs",
    selected: { garlic: false, parsley: false, salt: true, chili: false },
    notes: "Salt specialist",
  },
  {
    id: "spicetribe", name: "Spice Tribe",
    prices: { garlic: 5.33, parsley: 7.40, salt: 0, chili: 8.46 },
    freightPerLb: 0,
    freightNote: "TBD - get quote",
    selected: { garlic: false, parsley: false, salt: false, chili: false },
    notes: "Quoted pricing",
  },
  {
    id: "custom1", name: "(Add Supplier)",
    prices: { garlic: 0, parsley: 0, salt: 0, chili: 0 },
    freightPerLb: 0,
    freightNote: "",
    selected: { garlic: false, parsley: false, salt: false, chili: false },
    notes: "",
  },
];

function NumInput({ value, onChange, prefix, suffix, step, width, fontSize: fs }: {
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  width?: number;
  fontSize?: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
      {prefix && <span style={{ fontSize: 12, color: NAVY, fontWeight: 600 }}>{prefix}</span>}
      <input type="number" value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        step={step || 1}
        style={{
          width: width || 80, padding: "4px 6px", border: "1.5px solid #D0D5DD", borderRadius: 5,
          fontSize: fs || 13, fontFamily: "'JetBrains Mono', monospace", color: NAVY,
          fontWeight: 600, background: "#FAFBFC", outline: "none", textAlign: "right",
        }}
        onFocus={(e) => { e.target.style.borderColor = GOLD; }}
        onBlur={(e) => { e.target.style.borderColor = "#D0D5DD"; }}
      />
      {suffix && <span style={{ fontSize: 11, color: SLATE }}>{suffix}</span>}
    </div>
  );
}

export default function DustRunCalculator() {
  const [units, setUnits] = useState(14000);
  const [recipe, setRecipe] = useState<Recipe>(defaultRecipe);
  const [suppliers, setSuppliers] = useState<Supplier[]>(defaultSuppliers);
  const [showBench, setShowBench] = useState(false);
  const [aesCost, setAesCost] = useState(0.75);
  const [tubeCost, setTubeCost] = useState(0.31);
  const [sealCost, setSealCost] = useState(0.01);
  const [freightToSabah, setFreightToSabah] = useState(0.03);

  const rockyBenchmarkPerLb = 6.08;

  const updatePct = (id: string, val: number) => {
    setRecipe((r) => ({ ...r, ingredients: r.ingredients.map((i) => i.id === id ? { ...i, pctByWeight: val } : i) }));
  };

  const updatePrice = (sid: string, iid: string, val: number) => {
    setSuppliers((s) => s.map((sup) => sup.id === sid ? { ...sup, prices: { ...sup.prices, [iid]: val } } : sup));
  };

  const updateFreight = (sid: string, val: number) => {
    setSuppliers((s) => s.map((sup) => sup.id === sid ? { ...sup, freightPerLb: val } : sup));
  };

  const updateName = (sid: string, val: string) => {
    setSuppliers((s) => s.map((sup) => sup.id === sid ? { ...sup, name: val } : sup));
  };

  const selectSup = (sid: string, iid: string) => {
    setSuppliers((s) => s.map((sup) => ({ ...sup, selected: { ...sup.selected, [iid]: sup.id === sid } })));
  };

  const calc = useMemo(() => {
    const pctTotal = recipe.ingredients.reduce((s, i) => s + i.pctByWeight, 0);
    const blendG = units * recipe.fillWeightG * (1 + recipe.overagePct / 100);
    const blendLbs = blendG / GRAMS_PER_LB;

    const ings = recipe.ingredients.map((ing) => {
      const lbs = blendLbs * (ing.pctByWeight / 100);
      const lbsR = Math.ceil(lbs * 10) / 10;
      let selSup: Supplier | null = null, rawPrice = 0, freight = 0, landedPrice = 0, cost = 0;
      let bestLanded = Infinity, bestName = "", bestRaw = 0, bestFreight = 0;

      suppliers.forEach((s) => {
        const raw = s.prices[ing.id];
        const fr = s.freightPerLb;
        const landed = raw + fr;
        if (s.selected[ing.id] && raw > 0) {
          selSup = s; rawPrice = raw; freight = fr; landedPrice = landed; cost = lbsR * landed;
        }
        if (raw > 0 && landed < bestLanded) {
          bestLanded = landed; bestName = s.name; bestRaw = raw; bestFreight = fr;
        }
      });
      if (bestLanded === Infinity) bestLanded = 0;
      const isBest = selSup && landedPrice <= bestLanded + 0.005;

      return { ...ing, lbs, lbsR, selSup, rawPrice, freight, landedPrice, cost, bestLanded, bestName, bestRaw, bestFreight, isBest };
    });

    const totalCost = ings.reduce((s, i) => s + i.cost, 0);
    const perUnit = units > 0 ? totalCost / units : 0;
    const costPerLbBlend = blendLbs > 0 ? totalCost / blendLbs : 0;
    const bestTotal = ings.reduce((s, i) => s + (i.lbsR * i.bestLanded), 0);
    const bestPerUnit = units > 0 ? bestTotal / units : 0;
    const bestPerLbBlend = blendLbs > 0 ? bestTotal / blendLbs : 0;

    const rockyTotal = blendLbs * rockyBenchmarkPerLb;
    const rockyPerUnit = units > 0 ? rockyTotal / units : 0;

    return {
      pctTotal, blendG, blendLbs, ings, totalCost, perUnit, costPerLbBlend,
      bestTotal, bestPerUnit, bestPerLbBlend, savings: totalCost - bestTotal,
      rockyTotal, rockyPerUnit,
    };
  }, [units, recipe, suppliers, rockyBenchmarkPerLb]);

  const fmt = (n: number, d?: number) => "$" + n.toFixed(d === undefined ? 2 : d);
  const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 };
  const cell: React.CSSProperties = { padding: "7px 8px", fontSize: 12, borderBottom: "1px solid #EAEAEA", verticalAlign: "middle" as const };
  const hCell: React.CSSProperties = { ...cell, fontWeight: 700, fontSize: 10, color: "#FFF", background: NAVY, letterSpacing: "0.03em" };

  const fullCogs = calc.perUnit + aesCost + tubeCost + sealCost + freightToSabah;

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: "#F7F8FA", color: NAVY }}>
      <div style={{ background: NAVY, padding: "14px 24px", borderRadius: "8px 8px 0 0" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#FFF", letterSpacing: "0.04em" }}>L'ISOLINA — PRODUCTION RUN CALCULATOR</div>
        <div style={{ fontSize: 11, color: GOLD, marginTop: 2 }}>Spaghetti Dust: Aglio, Olio e Peperoncino | Batch #2.6 | 23g fill | {recipe.overagePct}% overage</div>
      </div>

      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "16px 24px" }}>

        {/* PARAMS */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          {[
            { label: "RUN SIZE", c: <NumInput value={units} onChange={setUnits} suffix="tubes" step={500} width={90} /> },
            { label: "FILL WEIGHT", c: <NumInput value={recipe.fillWeightG} onChange={(v) => setRecipe((r) => ({ ...r, fillWeightG: v }))} suffix="g" step={0.5} width={55} /> },
            { label: "OVERAGE", c: <NumInput value={recipe.overagePct} onChange={(v) => setRecipe((r) => ({ ...r, overagePct: v }))} suffix="%" step={0.1} width={50} /> },
            { label: "TOTAL BLEND", c: <div><div style={{ fontSize: 18, fontWeight: 700, ...mono }}>{calc.blendLbs.toFixed(1)} lbs</div><div style={{ fontSize: 10, color: SLATE }}>{Math.round(calc.blendG).toLocaleString()}g</div></div> },
          ].map((p, i) => (
            <div key={i} style={{ background: "#FFF", borderRadius: 8, padding: "10px 14px", border: "1px solid #E8E8E8", flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: SLATE, letterSpacing: "0.04em", marginBottom: 5 }}>{p.label}</div>
              {p.c}
            </div>
          ))}
        </div>

        {/* COST CARDS */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ background: "#FFF", borderRadius: 8, padding: "12px 16px", flex: 1, minWidth: 160, border: "1px solid #E8E8E8" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: SLATE, letterSpacing: "0.04em" }}>INGREDIENT COST</div>
            <div style={{ fontSize: 22, fontWeight: 700, ...mono, marginTop: 3 }}>{fmt(calc.totalCost)}</div>
            <div style={{ fontSize: 11, color: SLATE }}>{fmt(calc.perUnit, 4)}/unit | {fmt(calc.costPerLbBlend, 2)}/lb blend</div>
          </div>
          <div style={{ background: "#FFF", borderRadius: 8, padding: "12px 16px", flex: 1, minWidth: 160, border: "1px solid #E8E8E8" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: SLATE, letterSpacing: "0.04em" }}>FULL COGS / UNIT</div>
            <div style={{ fontSize: 22, fontWeight: 700, ...mono, marginTop: 3, color: NAVY }}>{fmt(fullCogs, 4)}</div>
            <div style={{ fontSize: 11, color: SLATE }}>total run: {fmt(fullCogs * units)}</div>
          </div>
          <div style={{
            background: calc.savings > 5 ? "#FFF5F5" : "#F0FFF0", borderRadius: 8, padding: "12px 16px",
            flex: 1, minWidth: 200, border: "1px solid " + (calc.savings > 5 ? "#E8AAAA" : "#A8E8A8"),
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: SLATE, letterSpacing: "0.04em" }}>YOUR CURRENT MIX</div>
            <div style={{ fontSize: 22, fontWeight: 700, ...mono, marginTop: 3, color: NAVY }}>
              {fmt(calc.costPerLbBlend, 2)}/lb
            </div>
            <div style={{ fontSize: 11, ...mono, color: SLATE, marginTop: 2 }}>
              {fmt(calc.perUnit, 4)}/unit | {fmt(calc.totalCost)} total
            </div>
            {calc.savings > 0.50 ? (
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: RED }}>
                Best mix: {fmt(calc.bestPerLbBlend, 2)}/lb — save {fmt(calc.savings)}
              </div>
            ) : (
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: GREEN }}>Optimal — best landed suppliers selected</div>
            )}
          </div>
          {/* ROCKY MOUNTAIN BENCHMARK */}
          <div style={{
            background: "#F5F0FF", borderRadius: 8, padding: "12px 16px",
            flex: 1, minWidth: 180, border: "1px solid #C8B8E8",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#6B4C9A", letterSpacing: "0.04em" }}>ROCKY MTN BENCHMARK</div>
            <div style={{ fontSize: 22, fontWeight: 700, ...mono, marginTop: 3, color: "#6B4C9A" }}>{fmt(rockyBenchmarkPerLb)}/lb</div>
            <div style={{ fontSize: 11, color: SLATE }}>
              {fmt(calc.rockyTotal)} total | {fmt(calc.rockyPerUnit, 4)}/unit
            </div>
            <div style={{
              fontSize: 11, fontWeight: 700, marginTop: 3,
              color: calc.costPerLbBlend < rockyBenchmarkPerLb ? GREEN : RED,
            }}>
              {calc.costPerLbBlend < rockyBenchmarkPerLb
                ? "Your mix saves " + fmt((rockyBenchmarkPerLb - calc.costPerLbBlend) * calc.blendLbs) + " vs Rocky Mtn"
                : "Rocky Mtn saves " + fmt((calc.costPerLbBlend - rockyBenchmarkPerLb) * calc.blendLbs) + " vs your mix"
              }
            </div>
          </div>
        </div>

        {Math.abs(calc.pctTotal - 100) > 0.01 && (
          <div style={{ background: "#FFF0F0", border: "1px solid " + RED, borderRadius: 6, padding: "8px 14px", marginBottom: 12, fontSize: 12, color: RED, fontWeight: 600 }}>
            Percentages total {calc.pctTotal.toFixed(2)}% (should be 100%)
          </div>
        )}

        {/* SOURCING MATRIX */}
        <div style={{ background: "#FFF", borderRadius: 8, border: "1px solid #E8E8E8", overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "8px 14px", background: GOLD, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>INGREDIENT SOURCING MATRIX</span>
            <span style={{ fontSize: 10, color: NAVY }}>Raw price + freight = landed cost. Radio selects supplier.</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...hCell, textAlign: "left", minWidth: 155 }}>Ingredient</th>
                  <th style={{ ...hCell, textAlign: "center", width: 55 }}>% Wt</th>
                  <th style={{ ...hCell, textAlign: "center", width: 70 }}>Lbs</th>
                  {suppliers.map((s) => (
                    <th key={s.id} style={{ ...hCell, textAlign: "center", minWidth: 150 }}>
                      <div>
                        {s.id === "custom1" ? (
                          <input type="text" value={s.name} onChange={(e) => updateName(s.id, e.target.value)}
                            placeholder="Supplier name" style={{ width: 110, padding: "3px 5px", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 3, fontSize: 10, color: "#FFF", background: "rgba(255,255,255,0.1)", outline: "none" }}
                          />
                        ) : <span style={{ fontSize: 11 }}>{s.name}</span>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 3 }}>
                        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>freight:</span>
                        <NumInput value={s.freightPerLb} onChange={(v) => updateFreight(s.id, v)} prefix="$" step={0.01} width={45} fontSize={10} />
                        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>/lb</span>
                      </div>
                      {s.freightNote && <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>{s.freightNote}</div>}
                    </th>
                  ))}
                  <th style={{ ...hCell, textAlign: "center", minWidth: 90, background: "#2E7D32" }}>Selected<br/>Cost</th>
                  <th style={{ ...hCell, textAlign: "center", minWidth: 80, background: "#2E7D32" }}>Best<br/>Landed</th>
                </tr>
              </thead>
              <tbody>
                {calc.ings.map((ing, idx) => (
                  <tr key={ing.id} style={{ background: idx % 2 === 0 ? "#FFF" : "#FAFBFC" }}>
                    <td style={{ ...cell, fontWeight: 600, color: NAVY, fontSize: 12 }}>{ing.name}</td>
                    <td style={{ ...cell, textAlign: "center" }}>
                      <NumInput value={ing.pctByWeight} onChange={(v) => updatePct(ing.id, v)} step={0.01} width={48} fontSize={12} />
                    </td>
                    <td style={{ ...cell, textAlign: "center", ...mono, fontSize: 12 }}>{ing.lbsR.toFixed(1)}</td>
                    {suppliers.map((sup) => {
                      const raw = sup.prices[ing.id];
                      const landed = raw > 0 ? raw + sup.freightPerLb : 0;
                      const sel = sup.selected[ing.id];
                      const isBest = raw > 0 && landed <= ing.bestLanded + 0.005;
                      return (
                        <td key={sup.id} style={{
                          ...cell, textAlign: "center",
                          background: sel ? "#E8F5E9" : undefined,
                        }}>
                          {raw > 0 || sup.id === "custom1" ? (
                            <div>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                                <input type="radio" name={"s-" + ing.id} checked={sel}
                                  onChange={() => selectSup(sup.id, ing.id)}
                                  disabled={raw === 0} style={{ cursor: raw > 0 ? "pointer" : "default", accentColor: GREEN, margin: 0 }}
                                />
                                <NumInput value={raw} onChange={(v) => updatePrice(sup.id, ing.id, v)} prefix="$" step={0.25} width={52} fontSize={11} />
                              </div>
                              {raw > 0 && (
                                <div style={{ fontSize: 10, marginTop: 2 }}>
                                  <span style={{ color: SLATE }}>landed: </span>
                                  <span style={{ fontWeight: 700, ...mono, fontSize: 11, color: isBest ? GREEN : NAVY }}>{fmt(landed)}</span>
                                </div>
                              )}
                              {isBest && raw > 0 && <div style={{ fontSize: 9, color: GREEN, fontWeight: 700, marginTop: 1 }}>BEST</div>}
                            </div>
                          ) : (
                            <span style={{ fontSize: 10, color: "#CCC" }}>n/a</span>
                          )}
                        </td>
                      );
                    })}
                    <td style={{
                      ...cell, textAlign: "center", ...mono, fontSize: 13,
                      fontWeight: 700, background: "#E8F5E9",
                    }}>
                      {ing.cost > 0 ? (
                        <div>
                          {fmt(ing.cost)}
                          <div style={{ fontSize: 9, color: SLATE, fontWeight: 400 }}>
                            {fmt(ing.rawPrice)}/lb + {fmt(ing.freight)}/lb
                          </div>
                        </div>
                      ) : <span style={{ color: "#CCC" }}>--</span>}
                    </td>
                    <td style={{
                      ...cell, textAlign: "center", fontSize: 11,
                      color: !ing.isBest && ing.cost > 0 ? ORANGE : GREEN, fontWeight: 600,
                    }}>
                      {ing.bestLanded > 0 && (
                        <div>
                          <span style={{ ...mono, fontSize: 11 }}>{fmt(ing.bestLanded)}/lb</span>
                          <div style={{ fontSize: 9, color: SLATE }}>{ing.bestName}</div>
                          {!ing.isBest && ing.cost > 0 && (
                            <div style={{ fontSize: 9, color: ORANGE, fontWeight: 700 }}>
                              Save {fmt((ing.landedPrice - ing.bestLanded) * ing.lbsR)}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {/* TOTAL ROW */}
                <tr style={{ background: NAVY }}>
                  <td style={{ ...cell, fontWeight: 700, color: "#FFF", fontSize: 12 }}>TOTAL</td>
                  <td style={{ ...cell, textAlign: "center", ...mono, color: Math.abs(calc.pctTotal - 100) < 0.01 ? GOLD : RED, fontWeight: 700, fontSize: 12 }}>
                    {calc.pctTotal.toFixed(1)}%
                  </td>
                  <td style={{ ...cell, textAlign: "center", ...mono, color: GOLD, fontWeight: 700, fontSize: 12 }}>{calc.blendLbs.toFixed(1)}</td>
                  {suppliers.map((s) => <td key={s.id} style={{ ...cell, color: "rgba(255,255,255,0.5)", fontSize: 9, textAlign: "center" }}>{s.notes}</td>)}
                  <td style={{ ...cell, textAlign: "center", ...mono, fontWeight: 700, background: "#2E7D32" }}>
                    <div style={{ color: "#FFF", fontSize: 15 }}>{fmt(calc.totalCost)}</div>
                    <div style={{ color: GOLD, fontSize: 11, marginTop: 2 }}>{fmt(calc.costPerLbBlend, 2)}/lb</div>
                  </td>
                  <td style={{ ...cell, textAlign: "center", ...mono, fontWeight: 700, background: "#2E7D32" }}>
                    <div style={{ color: GOLD, fontSize: 13 }}>{fmt(calc.bestTotal)}</div>
                    <div style={{ color: "#A8E8A8", fontSize: 11, marginTop: 2 }}>{fmt(calc.bestPerLbBlend, 2)}/lb</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* COGS WATERFALL + ORDER SUMMARY side by side */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ background: "#FFF", borderRadius: 8, padding: 16, border: "1px solid #E8E8E8", flex: 2, minWidth: 350 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 10 }}>COGS WATERFALL</div>
            {[
              { label: "Ingredients", val: calc.perUnit, fixed: true, color: NAVY, pct: calc.perUnit / fullCogs },
              { label: "AES production", val: aesCost, set: setAesCost, color: BLUE, pct: aesCost / fullCogs },
              { label: "Tubes (landed)", val: tubeCost, set: setTubeCost, color: GOLD, pct: tubeCost / fullCogs },
              { label: "Seal stickers (landed)", val: sealCost, set: setSealCost, color: SLATE, pct: sealCost / fullCogs },
              { label: "Freight to Sabah", val: freightToSabah, set: setFreightToSabah, color: ORANGE, pct: freightToSabah / fullCogs },
            ].map((row, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "7px 12px", borderBottom: "1px solid #F0F0F0", background: i % 2 === 0 ? "#FFF" : "#FAFBFC",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                  <div style={{ width: 4, height: 22, borderRadius: 2, background: row.color }} />
                  <span style={{ fontSize: 12, color: NAVY }}>{row.label}</span>
                </div>
                <div style={{ width: 120, height: 8, background: "#F0F0F0", borderRadius: 4, margin: "0 12px", overflow: "hidden" }}>
                  <div style={{ width: Math.min(row.pct * 100, 100) + "%", height: "100%", background: row.color, borderRadius: 4 }} />
                </div>
                <div style={{ width: 80, textAlign: "right" }}>
                  {row.fixed ? (
                    <span style={{ fontSize: 13, fontWeight: 700, ...mono }}>{fmt(row.val, 4)}</span>
                  ) : (
                    <NumInput value={row.val} onChange={row.set!} prefix="$" step={0.01} width={60} fontSize={12} />
                  )}
                </div>
              </div>
            ))}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 12px", background: NAVY, borderRadius: "0 0 6px 6px", marginTop: 2,
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#FFF" }}>TOTAL COGS / UNIT</span>
              <span style={{ fontSize: 18, fontWeight: 700, ...mono, color: GOLD }}>{fmt(fullCogs, 4)}</span>
            </div>
          </div>

          {/* ORDER SUMMARY */}
          <div style={{ background: "#FFF", borderRadius: 8, padding: 16, border: "1px solid #E8E8E8", flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 10 }}>ORDER SUMMARY</div>
            {calc.ings.map((ing) => (
              <div key={ing.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 12px", background: "#FAFBFC", borderRadius: 6, border: "1px solid #EAEAEA", marginBottom: 5,
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{ing.name}</div>
                  <div style={{ fontSize: 10, color: SLATE }}>
                    {ing.selSup ? ing.selSup.name : "?"} @ {fmt(ing.rawPrice)}/lb + {fmt(ing.freight)} freight
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, ...mono }}>{ing.lbsR.toFixed(1)} lbs</div>
                  <div style={{ fontSize: 12, ...mono, color: GREEN }}>{fmt(ing.cost)}</div>
                </div>
              </div>
            ))}
            <div style={{
              display: "flex", justifyContent: "space-between", padding: "10px 12px",
              background: NAVY, borderRadius: 6, marginTop: 4,
            }}>
              <div>
                <div style={{ fontWeight: 700, color: "#FFF", fontSize: 12 }}>TOTAL INGREDIENT ORDER</div>
                <div style={{ ...mono, color: GOLD, fontSize: 11 }}>{calc.blendLbs.toFixed(1)} lbs | {fmt(calc.costPerLbBlend, 2)}/lb</div>
              </div>
              <div style={{ fontSize: 17, ...mono, fontWeight: 700, color: "#FFF" }}>{fmt(calc.totalCost)}</div>
            </div>

            <div style={{
              marginTop: 10, padding: "10px 12px", background: "#F5F0FF", borderRadius: 6, border: "1px solid #C8B8E8",
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#6B4C9A", letterSpacing: "0.03em" }}>ROCKY MTN COMPARISON</div>
              <div style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                <span style={{ color: SLATE }}>Rocky Mtn blend @ </span>
                <span style={{ ...mono, fontWeight: 700 }}>{fmt(rockyBenchmarkPerLb)}/lb</span>
                <span style={{ color: SLATE }}> = </span>
                <span style={{ ...mono, fontWeight: 700 }}>{fmt(calc.rockyTotal)}</span>
                <span style={{ color: SLATE }}> ({fmt(calc.rockyPerUnit, 4)}/unit)</span>
              </div>
              <div style={{
                fontSize: 12, fontWeight: 700, marginTop: 4,
                color: calc.costPerLbBlend < rockyBenchmarkPerLb ? GREEN : RED,
              }}>
                {calc.costPerLbBlend < rockyBenchmarkPerLb
                  ? "Your mix is " + fmt(calc.costPerLbBlend, 2) + "/lb — saves " + fmt((rockyBenchmarkPerLb - calc.costPerLbBlend) * calc.blendLbs) + " vs Rocky Mtn"
                  : "Rocky Mtn saves " + fmt((calc.costPerLbBlend - rockyBenchmarkPerLb) * calc.blendLbs) + " — consider for convenience"
                }
              </div>
            </div>
          </div>
        </div>

        <button onClick={() => setShowBench(!showBench)} style={{
          background: "none", border: "1px solid #D0D5DD", borderRadius: 6, padding: "6px 14px",
          fontSize: 11, fontWeight: 600, color: SLATE, cursor: "pointer", marginBottom: 12,
        }}>
          {showBench ? "Hide" : "Show"} 30g Bench Blend Reference
        </button>
        {showBench && (
          <div style={{ background: CREAM, borderRadius: 6, padding: 14, border: "1px solid #E8D5A0", marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>30g Bench Reference</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12 }}>
              {recipe.ingredients.map((ing) => (
                <span key={ing.id}><span style={{ color: SLATE }}>{ing.name}: </span><span style={mono}>{(30 * ing.pctByWeight / 100).toFixed(2)}g</span></span>
              ))}
            </div>
          </div>
        )}

        <div style={{ fontSize: 10, color: SLATE, lineHeight: 1.6 }}>
          <strong>How to use:</strong> Set run size. Enter raw price/lb per supplier, plus freight/lb in the header row. Landed = raw + freight. Click radio to select supplier per ingredient. Matrix highlights best landed price. Rocky Mtn benchmark compares your sourced blend against their $6.08/lb all-in quote. All weights include {recipe.overagePct}% overage. Lbs rounded up to 0.1.
        </div>
      </div>
    </div>
  );
}
