/** Client-safe catalog of what Callwax can auto-resolve. */
export const ASSETS: { symbol: string; name: string; product: string }[] = [
  { symbol: "BTC", name: "Bitcoin", product: "BTC-USD" },
  { symbol: "ETH", name: "Ethereum", product: "ETH-USD" },
  { symbol: "SOL", name: "Solana", product: "SOL-USD" },
  { symbol: "SUI", name: "Sui", product: "SUI-USD" },
  { symbol: "XRP", name: "XRP", product: "XRP-USD" },
  { symbol: "DOGE", name: "Dogecoin", product: "DOGE-USD" },
  { symbol: "ADA", name: "Cardano", product: "ADA-USD" },
  { symbol: "LINK", name: "Chainlink", product: "LINK-USD" },
  { symbol: "AVAX", name: "Avalanche", product: "AVAX-USD" },
  { symbol: "LTC", name: "Litecoin", product: "LTC-USD" },
];
export const productOf = (symbol: string) => ASSETS.find((a) => a.symbol === symbol)?.product ?? `${symbol}-USD`;

export const LEAGUES: { id: string; name: string; sport: string; draw: boolean }[] = [
  { id: "soccer/eng.1", name: "Premier League", sport: "Football", draw: true },
  { id: "soccer/esp.1", name: "La Liga", sport: "Football", draw: true },
  { id: "soccer/ger.1", name: "Bundesliga", sport: "Football", draw: true },
  { id: "soccer/ita.1", name: "Serie A", sport: "Football", draw: true },
  { id: "soccer/fra.1", name: "Ligue 1", sport: "Football", draw: true },
  { id: "soccer/uefa.champions", name: "Champions League", sport: "Football", draw: true },
  { id: "soccer/usa.1", name: "MLS", sport: "Football", draw: true },
  { id: "soccer/mex.1", name: "Liga MX", sport: "Football", draw: true },
  { id: "basketball/nba", name: "NBA", sport: "Basketball", draw: false },
  { id: "football/nfl", name: "NFL", sport: "American football", draw: false },
  { id: "baseball/mlb", name: "MLB", sport: "Baseball", draw: false },
  { id: "hockey/nhl", name: "NHL", sport: "Ice hockey", draw: false },
];

