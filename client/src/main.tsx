import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import { API, request, setToken } from "./lib/api";
import { SymbolCanvas } from "./components/SymbolCanvas";

const socket = io(API, { autoConnect: false });

const App = () => {
  const [email, setEmail] = useState("a@a.com");
  const [password, setPassword] = useState("password123");
  const [me, setMe] = useState<any>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [presence, setPresence] = useState<Record<string, any>>({});
  const [encounter, setEncounter] = useState<any>(null);
  const [myMonsterId, setMyMonsterId] = useState("");
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [tameResult, setTameResult] = useState<string>("");
  const [feedMeat, setFeedMeat] = useState(2);
  const [starterOptions, setStarterOptions] = useState<any[]>([]);
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [tournamentMsg, setTournamentMsg] = useState("");

  const refreshMe = async () => setMe(await request("/me"));

  useEffect(() => {
    request("/content/starters").then(setStarterOptions).catch(() => undefined);
    request("/areas").then(setAreas).catch(() => undefined);
    socket.connect();
    socket.on("area:presence_update", (payload) => setPresence((prev) => ({ ...prev, [payload.areaId]: payload })));
    socket.on("tournament:status", (payload) => setTournamentMsg(`Tournament ${payload.status}`));
    socket.on("tournament:match_result", (payload) => setTournamentMsg(`Winner user ${payload.winnerUserId}`));
    return () => {
      socket.disconnect();
    };
  }, []);

  const chancePreview = useMemo(() => {
    if (!encounter) return 0;
    const hpPct = encounter.currentHp / encounter.maxHp;
    const diff = encounter.species.tameDifficulty;
    const base = (1 - diff) * 0.35 + Math.log2(feedMeat + 1) * 0.18 + (1 - hpPct) * 0.45;
    return Math.round(Math.min(0.95, Math.max(0.05, base)) * 100);
  }, [encounter, feedMeat]);

  const auth = async (path: string) => {
    const data = await request(path, "POST", { email, password });
    setToken(data.token);
    await refreshMe();
  };

  const chooseStarter = async (speciesId: string) => {
    await request("/starter/select", "POST", { speciesId });
    await refreshMe();
  };

  const startExplore = async (areaId: string) => {
    setSelectedArea(areaId);
    socket.emit("area:join", { areaId, username: email });
    const data = await request("/explore/start", "POST", { areaId });
    setEncounter(data);
  };

  const battleWild = async () => {
    if (!myMonsterId || !encounter) return;
    const data = await request("/battle/start", "POST", { yourMonsterId: myMonsterId, encounterId: encounter.encounterId });
    setBattleLog(data.rounds);
    if (data.rightHp !== undefined) setEncounter((prev: any) => ({ ...prev, currentHp: data.rightHp }));
    await refreshMe();
  };

  const tame = async () => {
    const data = await request("/encounter/tame", "POST", { encounterId: encounter.encounterId, meatUsed: feedMeat });
    setTameResult(data.success ? `Success (${Math.round(data.chance * 100)}%)` : `Failed (${Math.round(data.chance * 100)}%)`);
    await refreshMe();
  };

  const breed = async () => {
    if (me.user.monsters.length < 2) return;
    await request("/breed/start", "POST", { parentAId: me.user.monsters[0].instanceId, parentBId: me.user.monsters[1].instanceId });
    await refreshMe();
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", fontFamily: "sans-serif", padding: 12 }}>
      <h1>DUNGEONs Multiplayer MVP</h1>
      {!me ? (
        <section>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="password" />
          <button onClick={() => auth("/auth/register")}>Register</button>
          <button onClick={() => auth("/auth/login")}>Login</button>
        </section>
      ) : (
        <>
          <p>Meat: {me.user.inventory?.meat}</p>
          <p>{tournamentMsg}</p>
          {me.user.monsters.length === 0 ? (
            <section>
              <h2>Choose starter monster</h2>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {starterOptions.map((s) => (
                  <button key={s.id} onClick={() => chooseStarter(s.id)}>
                    <SymbolCanvas seed={s.renderSeed} size={64} />
                    <div>{s.name}</div>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <>
              <section>
                <h2>Your roster</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8 }}>
                  {me.user.monsters.map((m: any) => (
                    <div key={m.instanceId} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 8 }}>
                      <SymbolCanvas seed={m.species.renderSeed + m.instanceId} size={72} />
                      <div>{m.species.name} Lv.{m.level}</div>
                      <div>HP {m.currentHp}</div>
                      <div>Unspent points: {m.unspentStatPoints}</div>
                      <button onClick={() => setMyMonsterId(m.instanceId)}>Use for battle</button>
                      <button onClick={() => request("/monsters/allocate-stats", "POST", { monsterId: m.instanceId, allocations: { atk: 1, def: 0, spd: 0, hp: 0 } }).then(refreshMe)}>+ATK</button>
                    </div>
                  ))}
                </div>
                <button onClick={() => request("/rest", "POST").then(refreshMe)}>Rest (heal all)</button>
                <button onClick={breed}>Breed first two</button>
                <button onClick={() => request("/tournaments/join", "POST", { monsterId: myMonsterId || me.user.monsters[0].instanceId })}>Join Tournament</button>
              </section>

              <section>
                <h2>Areas</h2>
                {areas.map((a) => (
                  <button key={a.id} onClick={() => startExplore(a.id)} style={{ marginRight: 8 }}>
                    {a.name} ({presence[a.id]?.count ?? 0} online)
                  </button>
                ))}
                {selectedArea ? <p>Players here: {(presence[selectedArea]?.users ?? []).join(", ")}</p> : null}
              </section>

              {encounter ? (
                <section>
                  <h2>Encounter</h2>
                  <SymbolCanvas seed={encounter.species.renderSeed} size={88} />
                  <div>{encounter.species.name} Lv.{encounter.level}</div>
                  <div>Wild HP: {encounter.currentHp}/{encounter.maxHp}</div>
                  <button onClick={battleWild}>Battle</button>
                  <input type="number" value={feedMeat} min={1} max={20} onChange={(e) => setFeedMeat(Number(e.target.value))} />
                  <button onClick={tame}>Tame ({chancePreview}% est)</button>
                  <p>{tameResult}</p>
                  <pre>{battleLog.join("\n")}</pre>
                </section>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
};

createRoot(document.getElementById("root")!).render(<App />);
