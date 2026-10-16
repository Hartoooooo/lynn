// EIX_B-Klassifizierer – TypeScript-Portierung von klassifizierer.py
//
// Ordnet ein Wertpapier (per Name) den Lynn-Kategorien zu – zweistufig/hybrid mit
// Hebel-Erkennung und Underlying. Die Namensregeln (RULES) sind 1:1 aus dem
// Python-Skript übernommen; sie bilden den vollständig eigenständigen Teil der
// Klassifizierung (Stufe 2, Fallback über den Wertpapiernamen).
//
// Der mappingbasierte Teil (yfinance industry/category → Excel-Mapping) aus dem
// Python-Skript benötigt die separate Mapping-Excel; im Webapp-Kontext läuft
// deshalb die Namensregel-Logik plus – falls die ISIN bereits in der Datenbank
// liegt – deren gespeicherte Zuordnung (siehe API-Route).

import mapping from "@/lib/klassifizierer-mapping.json";

export type Dimension = "strategie" | "thema" | "region";
export type Membership = { ueber: string; unter: string };

type Rule = {
  id: string;
  kws: string[];
  excl: string[];
  dim: Dimension;
  ueber: string;
  unter: string;
};

// Reihenfolge innerhalb einer Dimension = Priorität.
export const RULES: Rule[] = [
  // ---- THEMEN ----
  { id: "krypto", kws: ["BITCOIN","ETHEREUM","SOLANA","CARDANO","XRP","RIPPLE","CRYPTO","POLKADOT","AVALANCHE","CHAINLINK","LITECOIN","STELLAR","TEZOS","AAVE","DIGITAL ASSET","BLOCKCHAIN","HODL","21SHARES","21 SHARES","BITWISE","DOGECOIN","UNISWAP","TONCOIN","STAKING","STAKED","MATIC","STABLECOIN","TOKENIS","TOKENIZ","METAVERSE"], excl: [], dim: "thema", ueber: "Krypto ETPs", unter: "" },
  { id: "uran", kws: ["URANIUM","URAN ","NUCLEAR","NUKLEAR","ATOMIC"], excl: [], dim: "thema", ueber: "Nuklear & Uranium", unter: "" },
  { id: "quantum", kws: ["QUANTUM"], excl: ["QUANTUM BATTERY","FIRST QUANTUM"], dim: "thema", ueber: "Quantum", unter: "" },
  { id: "robotics", kws: ["ROBOTIC","ROBOTER","HUMANOID","ROBOTICS","AUTOMATION"], excl: [], dim: "thema", ueber: "Robotics", unter: "" },
  { id: "semi_ai", kws: ["SEMICONDUCTOR","SEMICONDUCTORS"," CHIP","CHIPS ","ARTIFICIAL INTELLIGENCE","AI-","AI "," AI "," AI,"," A.I."], excl: [], dim: "thema", ueber: "Semiconductors & AI", unter: "" },
  { id: "defense", kws: ["AEROSPACE","DEFENSE","DEFENCE","RUESTUNG","RÜSTUNG","MILITARY","SPACE ","DRONE"], excl: [], dim: "thema", ueber: "Aerospace & Defense", unter: "" },
  { id: "biotech", kws: ["BIOTECH","PHARMA","HEALTHCARE","HEALTH CARE","MEDICAL","GENOMIC"], excl: [], dim: "thema", ueber: "Biotech & Pharma", unter: "" },
  { id: "energie_ern", kws: ["SOLAR","WIND","RENEWABLE","CLEAN ENERGY","ERNEUERBAR","PHOTOVOLT","HYDROGEN","WASSERSTOFF","ENERGY TRANSITION"], excl: [], dim: "thema", ueber: "Energie", unter: "Erneuerbare Energien" },
  { id: "gold", kws: ["GOLD"], excl: ["GOLDMAN"], dim: "thema", ueber: "Commodities", unter: "Gold & Gold Miners" },
  { id: "silber", kws: ["SILVER","SILBER"], excl: [], dim: "thema", ueber: "Commodities", unter: "Silber & Silber Miners" },
  { id: "platin", kws: ["PLATINUM","PLATIN","PALLADIUM"], excl: [], dim: "thema", ueber: "Commodities", unter: "Platin & Palladium" },
  { id: "kupfer", kws: ["COPPER","KUPFER"], excl: [], dim: "thema", ueber: "Commodities", unter: "Kupfer" },
  { id: "metalle", kws: ["MINING","MINERS","METALS","BERGBAU","NICKEL","LITHIUM","ZINC","ALUMINIUM","ALUMINUM","STEEL","IRON ORE","COBALT","RARE EARTH","TIN ","MANGANESE"], excl: [], dim: "thema", ueber: "Commodities", unter: "Metalle & Bergbau" },
  { id: "commodity_broad", kws: ["COMMODIT","ROGERS INTERNATIONAL","AGRICULTURE","COFFEE","SUGAR","WHEAT","CORN","COCOA","LEAN HOGS","SOYBEAN","NATURAL GAS","CRUDE","BRENT","WTI","NATGAS","GASOLINE","LIVESTOCK","GRAIN","BLEI","TIN ETC"], excl: ["LOW CARBON","CARBON NEUTRAL"], dim: "thema", ueber: "Commodities", unter: "Commodities ETFs" },
  { id: "energie_oil", kws: ["OIL","GAS","ENERGY","ÖL","OEL","PETROLEUM"], excl: [], dim: "thema", ueber: "Energie", unter: "Öl & Gas" },
  { id: "finanzen", kws: ["BANK","INSURANCE","FINANCIAL","VERSICHER","REIT","REAL ESTATE","IMMOBILIEN"], excl: ["EX FINANCIALS","EX-FINANCIALS","EX FINANCIAL"], dim: "thema", ueber: "Finanzen", unter: "Finanzen & Versicherungen" },
  { id: "software", kws: ["SOFTWARE","TECHNOLOGY","INTERNET","E-COMMERCE","ECOMMERCE","COMMUNICATION","CYBER","CLOUD"], excl: [], dim: "thema", ueber: "Software & IT", unter: "Software & IT" },
  // ---- REGIONEN ----
  { id: "nasdaq", kws: ["NASDAQ"], excl: [], dim: "region", ueber: "Nordamerika ETFs", unter: "Nasdaq ETFs" },
  { id: "sp500", kws: ["S&P 500","S&P500","S+P 500","SP 500","S & P 500"], excl: [], dim: "region", ueber: "Nordamerika ETFs", unter: "S&P 500 ETFs" },
  { id: "nordam", kws: ["UNITED STATES"," USA"," US ","U.S.","NORTH AMERICA","NORDAMERIKA","RUSSELL","DOW JONES","US SMALL","US EQUITY","US RESEARCH","MSCI USA","US QUALITY","CANADA","KANADA","ARK ","FAANG","PREFERRED"], excl: ["EX USA","EX-USA","EX US ","EX-US ","EX U.S","WORLD EX","EX-WORLD","GLOBAL EX"], dim: "region", ueber: "Nordamerika ETFs", unter: "Nordamerika ETFs" },
  { id: "schweiz", kws: ["SWITZERLAND","SWISS"," SMI","SPI "], excl: [], dim: "region", ueber: "Europa ETFs", unter: "Schweiz ETFs" },
  { id: "uk", kws: ["UNITED KINGDOM"," UK "," UK)","FTSE 100","FTSE100","FTSE 250","FTSE250","FTSE UK","BRITAIN"], excl: [], dim: "region", ueber: "Europa ETFs", unter: "UK ETFs" },
  { id: "dax", kws: ["DAX","GERMANY","DEUTSCHLAND","GERMAN "], excl: [], dim: "region", ueber: "Europa ETFs", unter: "DAX ETFs" },
  { id: "europa", kws: ["EUROPE","EUROPA","EURO STOXX","EUROZONE","STOXX EUROPE","EMU ","PAN EUROPEAN","EUROPEAN"], excl: [], dim: "region", ueber: "Europa ETFs", unter: "Europa ETFs" },
  { id: "china", kws: ["CHINA","CSI 300","CSI300","HANG SENG","HSCEI","GREATER CHINA","A-SHARE","A SHARE"], excl: [], dim: "region", ueber: "Asien ETFs", unter: "China ETFs" },
  { id: "indien", kws: ["INDIA","INDIEN","NIFTY","SENSEX"], excl: [], dim: "region", ueber: "Asien ETFs", unter: "Indien ETFs" },
  { id: "japan", kws: ["JAPAN","TOPIX","NIKKEI"], excl: [], dim: "region", ueber: "Asien ETFs", unter: "Japan ETFs" },
  { id: "asien", kws: ["ASIA","ASIEN","PACIFIC","PAZIFIK","KOREA","TAIWAN","ASEAN","EMERGING ASIA","FAR EAST"], excl: [], dim: "region", ueber: "Asien ETFs", unter: "Asien ETFs" },
  { id: "emerging", kws: ["EMERGING MARKET","EMERGING MKT","SCHWELLENLAEND","SCHWELLENLÄND"], excl: [], dim: "region", ueber: "World ETFs", unter: "Emerging Markets ETFs" },
  { id: "world", kws: ["ALL-WORLD","ALL WORLD","ALLWORLD","MSCI WORLD","FTSE ALL","ACWI","ALL COUNTRY","ALL-COUNTRY","WELT","GLOBAL","WORLD"], excl: ["GLOBAL X"], dim: "region", ueber: "World ETFs", unter: "All World ETFs" },
  // ---- STRATEGIE: Optionen/Income zuerst ----
  { id: "optionen", kws: ["OPTIONS ","OPTION ","OPTION)"," PUT "," CALL ","COVERED CALL","PUT PREMIUM","CALL PREMIUM","PREMIUM ETN","PREMIUM ETP","INCOMESHARES","INCOME ETP"], excl: [], dim: "strategie", ueber: "Leverage ETPs", unter: "Option Shares" },
  // ---- STRATEGIE: Hebel ----
  { id: "leverage", kws: ["LEVERAGE SHARES","3X ","2X ","5X ","-1X","-2X","-3X","-5X"," SHORT ","DAILY LEVERAGED","DAILY SHORT","LEVERAGED ","INVERSE"], excl: [], dim: "strategie", ueber: "Leverage ETPs", unter: "Leverage Shares" },
];

// Feste Mappings aus der Mapping-Excel: yfinance industry/industryKey bzw. ETF-category → (Überkat, Unterkat).
const MAPPING = mapping as unknown as {
  industry: Record<string, [string, string]>;
  category: Record<string, [string, string]>;
};

/** Normalisierung wie im Python-Skript: Kleinbuchstaben, nur a-z0-9. */
function norm(s: string | null | undefined): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Zu grobe yfinance-Kategorien, die NICHT als feine Zuordnung zählen (Stufe 1b).
const GROB = new Set(
  [
    "natural resources",
    "focused region",
    "miscellaneous sector",
    "commodities focused",
    "equity precious metals",
    "large blend",
    "large growth",
    "small blend",
    "mid-cap growth",
  ].map(norm),
);

/** Hebelfaktor als vorzeichenbehaftete Ganzzahl; Short/Inverse → negativ. null wenn keiner. */
export function hebelAusName(name: string | null | undefined): number | null {
  if (!name) return null;
  const n = name.toUpperCase().replace(/ /g, " ");
  // FX-Paare 'Short X Long Y 3x' → Betrag positiv (Richtung steckt im Paarnamen)
  const fxPair = /\b(SHORT|LONG)\b.*\b(EUR|USD|GBP|JPY|CHF)\b.*\b(SHORT|LONG)\b/.test(n);
  const m = n.match(/(-?)(\d+)\s*X\b/);
  if (!m) {
    if (n.includes("DAILY SHORT") || n.includes("INVERSE") || (/\bSHORT\b/.test(n) && !n.includes("LEVERAG"))) {
      return -1;
    }
    return null;
  }
  const base = parseInt(m[2]!, 10);
  if (fxPair) return base;
  let neg = Boolean(m[1]) || n.includes("SHORT") || n.includes("INVERSE") || n.includes("BEAR");
  if (n.includes("LONG") && !m[1] && !n.includes("SHORT")) neg = false;
  return neg ? -base : base;
}

/** Worauf ein (Leverage/Option) Produkt läuft: Einzelaktie/Index/Asset aus dem Namen. */
export function underlyingAusName(name: string | null | undefined): string {
  if (!name) return "";
  let u = " " + name + " ";
  u = u.replace(/leverage shares/gi, " ");
  u = u.replace(/-?\d+\s*x\b/gi, " "); // Hebelfaktor 3x, -1x ...
  u = u.replace(/\b(long|short|daily|leveraged|inverse|unlimited|securit\w*|etp|etc|etn|etf|ucits|acc|dist)\b/gi, " ");
  u = u.split("(")[0]!; // Klammer-Zusätze weg
  u = u.replace(/\s+/g, " ").replace(/^[\s\-.,()&/]+|[\s\-.,()&/]+$/g, "");
  u = u.replace(/\s+[A-Z]$/, "").trim(); // einzelner Rest-Buchstabe am Ende
  return u;
}

function nameDimensionHits(name: string | null | undefined) {
  const n = " " + (name || "").toUpperCase().replace(/ /g, " ").replace(/\s+/g, " ") + " ";
  const strat: Membership[] = [];
  const thema: Membership[] = [];
  const region: Membership[] = [];
  for (const r of RULES) {
    if (r.excl.some((x) => n.includes(x))) continue;
    if (r.kws.some((k) => n.includes(k))) {
      const tup = { ueber: r.ueber, unter: r.unter };
      if (r.dim === "strategie") strat.push(tup);
      else if (r.dim === "thema") thema.push(tup);
      else region.push(tup);
    }
  }
  return { strat, thema, region };
}

function dedup(seq: Membership[]): Membership[] {
  const out: Membership[] = [];
  for (const x of seq) {
    if (!out.some((o) => o.ueber === x.ueber && o.unter === x.unter)) out.push(x);
  }
  return out;
}

export type Classification = {
  kategorie: Membership | null;
  hebel: number | null;
  quelle: string;
  underlying: string;
  memberships: Membership[];
};

export type ClassifyInput = {
  name?: string | null;
  /** yfinance info['industry'] (nur Aktien) */
  industry?: string | null;
  /** yfinance info['industryKey'] (Slug, nur Aktien) */
  industryKey?: string | null;
  /** yfinance info['category'] (Fondskategorie, nur ETFs/ETPs) */
  category?: string | null;
};

/**
 * Vollständige 2-stufige/hybride Klassifizierung wie klassifizierer.py – GENAU EINE Kategorie:
 * Stufe 1 yfinance (Aktie→industry, ETF→feine category), Stufe 2 Namensregeln (Thema>Region),
 * dann Hebel, dann grobe category. Liefert zusätzlich Mehrfach-Mitgliedschaften und Underlying.
 */
export function klassifiziere({ name, industry, industryKey, category }: ClassifyInput): Classification {
  const hebel = hebelAusName(name);

  // ---- Aktie: ausschließlich über industry (kein Hebel, keine Mehrfach-Logik) ----
  if (industry) {
    const hit = MAPPING.industry[norm(industryKey)] ?? MAPPING.industry[norm(industry)];
    if (hit) {
      const kat = { ueber: hit[0], unter: hit[1] };
      return { kategorie: kat, hebel: null, quelle: "yfinance industry", underlying: "", memberships: [kat] };
    }
  }

  // ---- Emittent 'Leverage Shares' → IMMER Leverage ETPs, Underlying separat ----
  if (name && name.toUpperCase().includes("LEVERAGE SHARES")) {
    const kat = { ueber: "Leverage ETPs", unter: "Leverage Shares" };
    return { kategorie: kat, hebel, quelle: "Leverage Shares (Emittent)", underlying: underlyingAusName(name), memberships: [kat] };
  }

  // ---- ETF/ETP/Fonds ----
  const { strat, thema, region } = nameDimensionHits(name);
  const unterl = dedup([...thema, ...region]); // Underlyings (Thema vor Region)
  const istLeverage = strat.length > 0 || hebel !== null;

  const normCat = norm(category);
  const fineCat = category && !GROB.has(normCat) ? MAPPING.category[normCat] : undefined;
  const coarseCat = category ? MAPPING.category[normCat] : undefined;

  let kat: Membership | null;
  let quelle: string;
  if (fineCat) {
    kat = { ueber: fineCat[0], unter: fineCat[1] };
    quelle = "yfinance category";
  } else if (thema.length) {
    kat = thema[0]!;
    quelle = "Namensregel (Thema)";
  } else if (region.length) {
    kat = region[0]!;
    quelle = "Namensregel (Region)";
  } else if (istLeverage) {
    kat = strat.length ? strat[0]! : { ueber: "Leverage ETPs", unter: "Leverage Shares" };
    quelle = "Leverage/Option (Einzel-Underlying)";
  } else if (coarseCat) {
    kat = { ueber: coarseCat[0], unter: coarseCat[1] };
    quelle = "yfinance category (grob)";
  } else {
    kat = null;
    quelle = "KEINE ZUORDNUNG";
  }

  const underlying = kat && kat.ueber === "Leverage ETPs" ? underlyingAusName(name) : "";

  // Mehrfach-Mitgliedschaft: Hauptkategorie zuerst, dann die übrigen Dimensionen.
  const memberships = kat ? dedup([kat, ...strat, ...unterl]) : [];

  return { kategorie: kat, hebel, quelle, underlying, memberships };
}

/** Kurzform: Klassifizierung allein über den Wertpapiernamen (Stufe 2). */
export function klassifiziereNachName(name: string | null | undefined): Classification {
  return klassifiziere({ name });
}

// Klassifizierer-Oberkategorien → tatsächliche Blattnamen der Importliste.
const CATEGORY_ALIASES: Record<string, string> = {
  "Nordamerika ETFs": "Nordamerika",
  "Aerospace & Defense": "Areospace & Defense",
};

/** Bildet eine Klassifizierer-Oberkategorie auf den Kategorienamen in der Datenbank ab. */
export function categoryAlias(ueber: string): string {
  return CATEGORY_ALIASES[ueber] ?? ueber;
}

export function formatMembership(m: Membership): string {
  return m.unter ? `${categoryAlias(m.ueber)} / ${m.unter}` : categoryAlias(m.ueber);
}
