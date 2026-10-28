export type VoiceKind = "pundit" | "friend" | "self" | "bot";

export interface Voice {
  slug: string;
  name: string;
  kind: VoiceKind;
  /** public profile / handle, free text */
  handle?: string;
  /** true for clearly labelled sample voices */
  sample?: boolean;
}

export interface Anchor {
  chain: "sui:mainnet";
  seq: number;
  digest: string;
  /** checkpoint timestamp (ISO) – the seal cannot have been made before this */
  ts: string;
  epoch: number;
  via: "tatum-graphql";
}

export type Rule =
  | { type: "price"; asset: string; quote: "USD"; op: "above" | "below"; threshold: number }
  | {
      type: "sui_metric";
      metric: "epoch" | "total_transactions" | "reference_gas_price";
      op: "at_least" | "below";
      threshold: number;
    }
  | {
      type: "sports";
      league: string; // espn path e.g. soccer/eng.1
      leagueName: string;
      eventId: string;
      home: string;
      away: string;
      pick: "home" | "draw" | "away";
      kickoff: string;
    }
  | { type: "manual"; rule: string };

export type RuleType = Rule["type"];

/** The canonical, hashed body of a sealed call. */
export interface SealBody {
  v: 1;
  voice: Voice;
  claim: string;
  rule: Rule;
  /** probability (0.01–0.99) that the claim is TRUE */
  p: number;
  /** when the claim is checked */
  deadline: string;
  sealedAt: string;
  /** "live": sealed before its deadline. "backfill": deadline already passed – an old call being archived. */
  mode: "live" | "backfill";
  /** backfill only: when the voice says they originally made the call */
  claimedAt?: string;
  source?: { url?: string; quote?: string };
  anchor: Anchor;
  nonce: string;
  /** for manual calls: sha256 of the resolver key (the key itself is shown once to the sealer) */
  resolverKeyHash?: string;
}

export interface SealRecord extends SealBody {
  id: string;
  hash: string;
}

export type Outcome = "true" | "false" | "void";

export interface ResolutionBody {
  v: 1;
  callId: string;
  sealHash: string;
  voiceSlug: string;
  outcome: Outcome;
  resolvedAt: string;
  method: "auto:coinbase-1m" | "auto:sui-checkpoint" | "auto:espn-final" | "manual";
  /** machine-checkable evidence: observed value, sources, checkpoint ids … */
  evidence: Record<string, unknown>;
  note?: string;
}
export interface ResolutionRecord extends ResolutionBody {
  hash: string;
}

export interface WalrusMeta {
  memoryId?: string;
  blobId?: string;
  createdAt?: string;
  size?: number;
  jobId?: string;
  status: "pending" | "done" | "failed";
}

export interface Call {
  seal: SealRecord;
  sealMeta: WalrusMeta;
  resolution?: ResolutionRecord;
  resolutionMeta?: WalrusMeta;
}

export interface CalibrationBin {
  lo: number;
  hi: number;
  n: number;
  meanP: number;
  freq: number;
}

export interface VoiceStats {
  voice: Voice;
  total: number;
  open: number;
  resolved: number;
  /** only live-sealed calls (sealed before outcome) */
  verified: { n: number; brier: number | null; hit: number | null; skill: number | null };
  /** everything incl. backfilled archives */
  all: { n: number; brier: number | null; hit: number | null; skill: number | null };
  bins: CalibrationBin[];
}
