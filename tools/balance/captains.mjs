// The scripted captains the hull tools choose from (matrix.mjs, counter.mjs). A captain is a route of fight steps
// (see harness.js): how she moves, what she fires, whether she boards, and with `until` when one step gives way to the
// next. play: the kind of fight she makes, for the identity cards. keepOff bears away from a stronger boarder;
// windward beats up to her weather side before fighting. oared: galleys only.
const step = (o) => [{ kill: 'all', ...o }];
// play: the kind of fight she makes, for the identity cards. keepOff bears away from a stronger boarder; windward
// beats up to her weather side before fighting (see harness.js).
export const CAPTAINS = {
  guns: { k: 'g', play: 'broadsides', route: step({ move: 'duel', ammo: 'round' }) },
  wary: { k: 'w', play: 'broadsides', route: step({ move: 'duel', ammo: 'round', keepOff: true }) },
  weather: { k: 'e', play: 'broadsides', route: step({ move: 'duel', ammo: 'round', windward: true }) },
  kite: { k: 'k', play: 'long range', route: step({ move: 'kite', ammo: 'round' }) },
  kiteWary: { k: 'l', play: 'long range', route: step({ move: 'kite', ammo: 'round', keepOff: true }) },
  hug: { k: 'h', play: 'under her stern', route: step({ move: 'hug', ammo: 'round' }) },
  hugWary: { k: 's', play: 'under her stern', route: step({ move: 'hug', ammo: 'round', keepOff: true }) },
  hugWeather: { k: 'u', play: 'under her stern', route: step({ move: 'hug', ammo: 'round', windward: true }) },
  burn: { k: 'f', play: 'fire', route: step({ move: 'duel', ammo: 'fire' }) },
  prep: { k: 'p', board: true, play: 'cripple and board', route: step({ move: 'duel', ammo: 'combo', board: 'odds' }) },
  prepWary: { k: 'q', board: true, play: 'cripple and board', route: step({ move: 'duel', ammo: 'combo', board: 'odds', keepOff: true }) },
  prepWeather: { k: 'v', board: true, play: 'cripple and board', route: step({ move: 'duel', ammo: 'combo', board: 'odds', windward: true }) },
  hugBoard: { k: 'b', board: true, play: 'cripple and board', route: step({ move: 'hug', ammo: 'combo', board: 'odds' }) },
  hugBoardWeather: { k: 'x', board: true, play: 'cripple and board', route: step({ move: 'hug', ammo: 'combo', board: 'odds', windward: true }) },
  rush: { k: 'r', board: true, play: 'rush aboard', route: step({ move: 'duel', ammo: 'grape', board: 'rush' }) },
  bow: { k: 'o', oared: true, play: 'bow guns', route: step({ move: 'bow', ammo: 'round', rangeK: 0.3 }) }, // found by search.mjs
  bowWeather: { k: 'y', oared: true, play: 'bow guns', route: step({ move: 'bow', ammo: 'round', rangeK: 0.3, windward: true }) },
  // plans in phases: an opener, then the main fight
  chainOpen: { k: 'c', play: 'broadsides', route: [{ kill: 'all', move: 'duel', ammo: 'chain', until: { foeSails: 0.55 } }, { kill: 'all', move: 'duel', ammo: 'round' }] },
  chainHug: { k: 'C', play: 'under her stern', route: [{ kill: 'all', move: 'duel', ammo: 'chain', until: { foeSails: 0.55 } }, { kill: 'all', move: 'hug', ammo: 'round' }] },
  grapeBoard: { k: 'G', board: true, play: 'cripple and board', route: [{ kill: 'all', move: 'duel', ammo: 'grape', keepOff: true, until: { foeCrew: 0.55 } }, { kill: 'all', move: 'duel', ammo: 'grape', board: 'odds', odds: 1 }] },
};
export const OARED = ['galley', 'galliot'];
