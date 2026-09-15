/* ==========================================================================
   data.js - loads the JSON, indexes it, and turns players into questions.
   Nothing in here touches the DOM.
   ========================================================================== */

const cache = {
  leagues: null,
  clubLogos: null,
  players: new Map(), // leagueId -> array of players
};

async function getJSON(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

/* ---------- loading ------------------------------------------------------- */

export async function loadLeagues() {
  if (cache.leagues) return cache.leagues;
  const data = await getJSON('data/leagues.json');
  cache.leagues = data.leagues;
  return cache.leagues;
}

/** Club ids that have a real crest file in assets/clubs/. Empty by default. */
export async function loadClubLogos() {
  if (cache.clubLogos) return cache.clubLogos;
  try {
    const data = await getJSON('data/club-logos.json');
    cache.clubLogos = new Set(data.clubs || []);
  } catch {
    cache.clubLogos = new Set();
  }
  return cache.clubLogos;
}

export async function loadPlayers(leagueId) {
  if (cache.players.has(leagueId)) return cache.players.get(leagueId);
  const data = await getJSON(`data/players/${leagueId}.json`);
  const players = (data.players || []).map(normalisePlayer);
  cache.players.set(leagueId, players);
  return players;
}

export function getLeague(leagues, id) {
  return leagues.find((l) => l.id === id) || null;
}

/* ---------- normalising --------------------------------------------------- */

/**
 * A club entry may carry `years` (new data) or `weight` (data migrated from the
 * original Pygame game, where the number was the career share it scored).
 * `strength` is whichever is present, so the rest of the code only reads one field.
 */
function clubStrength(club) {
  if (typeof club.years === 'number') return club.years;
  if (typeof club.weight === 'number') return club.weight;
  return 1;
}

function normalisePlayer(raw) {
  const clubs = (raw.clubs || [])
    .map((c) => ({ ...c, strength: clubStrength(c) }))
    .sort((a, b) => b.strength - a.strength);

  const topStrength = clubs.length ? clubs[0].strength : 0;

  return {
    ...raw,
    tier: raw.tier || 'hard',
    clubs,
    topStrength,
    // more than one club can share the top spot - both count as fully correct
    mainClubIds: clubs.filter((c) => c.strength === topStrength).map((c) => c.id),
  };
}

/* ---------- filtering ----------------------------------------------------- */

/** Players available for a difficulty, restricted to those we can actually ask about. */
export function poolFor(players, league, difficulty) {
  const leagueClubIds = new Set(league.clubs.map((c) => c.id));
  return players.filter((p) => {
    if (!difficulty.tiers.includes(p.tier)) return false;
    // the answer has to be a club we can show as an option
    return p.mainClubIds.some((id) => leagueClubIds.has(id));
  });
}

/* ---------- picking ------------------------------------------------------- */

export function shuffle(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * A queue that walks a shuffled pool so the same player cannot come back
 * until every other player has been used.
 */
export function createQueue(pool) {
  let order = shuffle(pool);
  let index = 0;

  function take() {
    if (index >= order.length) {
      order = shuffle(pool);
      index = 0;
    }
    return order[index++];
  }

  return {
    size: pool.length,
    next: take,

    /**
     * The next player who can be answered with one of `clubIds`.
     * Used by the arena, which keeps the same four corners while cards are in
     * play. Returns null when nobody in the pool fits.
     */
    nextMatching(clubIds) {
      const wanted = new Set(clubIds);
      for (let tries = 0; tries < pool.length; tries += 1) {
        const player = take();
        if (player.mainClubIds.some((id) => wanted.has(id))) return player;
      }
      return null;
    },
  };
}

/* ---------- question building --------------------------------------------- */

const SECONDARY_CHANCE = 0.55;

/**
 * Builds one question: the player, the club buttons, and what each button scores.
 * Scores mirror the original game - the main club is worth 100, a club he really
 * played for but not the longest is worth its share of the career.
 */
export function buildQuestion(player, league, difficulty, options = {}) {
  const { fixedClubs = null, optionCount = difficulty.options } = options;
  const byId = new Map(league.clubs.map((c) => [c.id, c]));

  // The arena pins its four corners, so the clubs are handed in rather than drawn.
  // Accept either club objects or plain ids.
  if (fixedClubs) {
    const pinned = fixedClubs.map((c) => (typeof c === 'string' ? byId.get(c) : c)).filter(Boolean);
    return describeOptions(player, pinned, byId);
  }

  const played = player.clubs.filter((c) => byId.has(c.id));

  const main = played.find((c) => player.mainClubIds.includes(c.id)) || played[0];
  const secondaries = played.filter((c) => c.id !== main.id);

  const chosen = [main];

  // Optionally slip in a club he genuinely played for - partial credit lives here.
  if (secondaries.length && Math.random() < SECONDARY_CHANCE) {
    chosen.push(secondaries[Math.floor(Math.random() * secondaries.length)]);
  }

  const chosenIds = new Set(chosen.map((c) => c.id));
  const playedIds = new Set(played.map((c) => c.id));
  const distractors = shuffle(league.clubs.filter((c) => !chosenIds.has(c.id) && !playedIds.has(c.id)));

  const slots = Math.min(optionCount, league.clubs.length);
  while (chosen.length < slots && distractors.length) chosen.push(distractors.pop());

  // If the league is tiny, top up with any remaining club so the grid stays full.
  if (chosen.length < slots) {
    const rest = shuffle(league.clubs.filter((c) => !chosen.some((x) => x.id === c.id)));
    while (chosen.length < slots && rest.length) chosen.push(rest.pop());
  }

  return describeOptions(player, shuffle(chosen), byId);
}

/** Turns a list of clubs into answer options for this player, in the order given. */
function describeOptions(player, clubs, byId) {
  const options = clubs.map((club) => {
    const entry = player.clubs.find((c) => c.id === club.id);
    return {
      ...(byId.get(club.id) || club),
      points: entry ? scoreFor(entry, player) : 0,
      played: Boolean(entry),
      isMain: player.mainClubIds.includes(club.id),
      years: entry ? entry.years : null,
    };
  });
  return { player, options };
}

/**
 * Picks the four clubs the arena puts in its corners: the ones the most players
 * in this pool actually answer to, so a round keeps finding cards to ask about.
 */
export function pickCorners(pool, league, count = 4) {
  const tally = new Map();
  pool.forEach((player) => {
    player.mainClubIds.forEach((id) => tally.set(id, (tally.get(id) || 0) + 1));
  });

  const ranked = league.clubs
    .filter((club) => tally.has(club.id))
    .sort((a, b) => tally.get(b.id) - tally.get(a.id));

  // Take a random slice of the well-represented clubs so rounds are not identical
  const strong = ranked.slice(0, Math.max(count, Math.ceil(ranked.length * 0.6)));
  const corners = shuffle(strong).slice(0, count);

  // Top up from anywhere if the league is small
  if (corners.length < count) {
    const rest = shuffle(league.clubs.filter((c) => !corners.some((x) => x.id === c.id)));
    while (corners.length < count && rest.length) corners.push(rest.pop());
  }
  return corners;
}

/** Base points a club is worth for this player: 100 for his main club, less for the rest. */
export function scoreFor(clubEntry, player) {
  if (!player.topStrength) return 0;
  return Math.max(10, Math.round((clubEntry.strength / player.topStrength) * 100));
}

/** The full career, ranked, for the reveal panel. */
export function careerOf(player) {
  return player.clubs.map((c) => ({
    id: c.id,
    name: c.name,
    years: c.years ?? null,
    share: player.topStrength ? c.strength / player.topStrength : 0,
    isMain: player.mainClubIds.includes(c.id),
  }));
}
