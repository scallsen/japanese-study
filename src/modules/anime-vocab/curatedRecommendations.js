// Curated "recommended for beginners" list — cross-referenced from multiple
// Japanese-learning community sources (GaijinPot, JLPT Samurai, Tofugu,
// Migaku, r/LearnJapanese-adjacent immersion guides) rather than sourced
// from Jiten's own raw difficulty-ascending catalog sort. That sort just
// surfaces whatever has the single lowest difficultyRaw score across
// Jiten's ENTIRE catalog (any media type, no curation), which in practice
// turned up odd picks — random OVAs, a manga, whatever happened to score
// lowest — rather than what people actually recommend for learners.
//
// jitenDeckId values were resolved by hand against Jiten's
// search-suggestions API — re-verify if a title stops resolving (a show
// getting re-indexed under a new deckId, for example).
export const CURATED_RECOMMENDATIONS = [
  { title: "Chi's Sweet Home", jitenDeckId: '35341' },
  { title: "Shirokuma Cafe (Polar Bear's Café)", jitenDeckId: '10382' },
  { title: 'Doraemon', jitenDeckId: '39835' },
  { title: 'Yotsuba&!', jitenDeckId: '96859' },
  { title: 'Sazae-san', jitenDeckId: '41793' },
  { title: 'My Neighbor Totoro', jitenDeckId: '7389' },
  { title: 'Pokémon', jitenDeckId: '8868' },
  { title: 'K-ON!', jitenDeckId: '10305' },
  { title: 'NEW GAME!', jitenDeckId: '35791' },
  { title: 'SPY×FAMILY', jitenDeckId: '8766' },
  { title: 'Haikyuu!!', jitenDeckId: '38376' },
]
