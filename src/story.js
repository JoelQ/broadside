// All of the campaign's words. No code reads meaning from this file: change any line freely.
//
// A story page is told a step at a time (dialog.js). Each entry of its `text` is one step: a string is narration,
// and say(who, text) is a line someone says, shown with their portrait and name. `who` is a key of CAST in
// portraits.js. Keep a step to a few sentences: it has to fit on a phone held sideways.
//
// The war is real; you, your officers and your rivals are invented. Real things kept in the
// background: Venice held Candia through a siege of more than twenty years; the Ottomans took
// Chania at the start of the war; Venice blockaded the Dardanelles in the 1650s; the island
// fortress of Suda stayed Venetian; Candia was surrendered in September 1669 by Francesco
// Morosini to the Grand Vizier, Köprülü Fazıl Ahmed. The Venetian ending here departs from that.
// The campaign covers the last years of the siege, and on purpose it moves the Dardanelles blockade
// (The straits) to those years too: the game only has to agree with itself, so leave that be.
// No years are shown on screen.

export const SIDE_NAME = { venice: 'Venice', ottoman: 'the Ottoman fleet' };
export const PORTS = { island: 'Lychna', venice: 'Suda', ottoman: 'Chania' };

// Ship names. NAMES.venice are Venetian ships (met as enemies when you serve the Porte, and the
// names the playtest build gives your own ships when you serve Venice), and the other way about.
// Ottoman galleys were known by their captains, so theirs carry a captain's name.
export const NAMES = {
  home: 'Agia Marina',
  venice: {
    picket: 'San Zorzi', heavy: 'Golden Lion', brig: 'La Fede', powder: 'Santa Caterina', galley1: 'Galley Querini', galley2: 'Galley Dolfin',
    flag: 'Leon Coronato', koules: 'Rocca a Mare', castleW: 'West castle', castleE: 'East castle',
    friends: ['La Prudenza', 'San Nicolò', 'Wapen van Hoorn'], foes: ['La Prudenza', 'Galley Zorzi', 'Wapen van Hoorn'],
    lent: { sloop: 'Rondinella', xebec: 'Sant’Antonio', galley: 'Galley Loredan', merchantman: 'Madonna del Rosario' },
  },
  ottoman: {
    picket: 'Kara Ali Reis', heavy: 'Bahr-i Zafer', brig: 'Şahin', powder: 'Bereket', galley1: 'Hasan Reis', galley2: 'Deli Yusuf Reis',
    flag: 'Fethiye', koules: 'Su Kulesi', castleW: 'Kilitbahir', castleE: 'Kale-i Sultaniye',
    friends: ['Şimşek', 'Mustafa Reis', 'Nusret'], foes: ['Şimşek', 'Mustafa Reis', 'Nusret'],
    lent: { sloop: 'Kırlangıç', xebec: 'Yıldırım', galley: 'Galley of Ahmed Reis', merchantman: 'Selamet' },
  },
};

const V = 'venice', O = 'ottoman';
const say = (who, text) => ({ who, text });
export const STORY = {
  opening: {
    eyebrow: 'Lychna, in the Aegean', title: 'Home waters',
    text: [
      'Lychna is a rock with one harbour, forty houses and a chapel. It pays its tax to the Sultan and sells its wine to whoever calls. You captain the island’s brig, the <i>Agia Marina</i>, which mostly means counting barrels.',
      'There is a war on. Twenty summers ago the Sultan’s army landed on Crete, and the Venetians are still shut up in the great city of Candia with the sea at their backs. On Lychna the war has meant higher prices and fewer honest ships.',
      'This morning the goatherd’s boy ran down from the ridge. A sail to the south, black-hulled, standing in for the harbour, and nobody on the island owns a black hull.',
    ],
    go: 'Clear for action',
  },
  choice: {
    title: 'Two offers',
    // the opening shot, over both ships sailing in; then the dialog
    card: { eyebrow: 'Lychna, a week later', line: 'A fight off a small island is news for a week. Before the week is out, two boats call at Lychna.' },
    text: [
      'The first brings Ser Alvise, a Venetian gentleman from Suda, in black and crimson, with a purse and a paper.',
      say('recruiter', '“The Republic is hiring ships to keep Candia alive. A captain who can fight a brig like that should not be carrying wine.”'),
      'The second brings Hüseyin Efendi, a quiet man who keeps the Kapudan Pasha’s papers at Chania. He has a paper too.',
      say('secretary', '“The Sultan’s fleet has need of captains who know these islands. And Lychna is the Sultan’s island, after all.”'),
      'Old Manolis, who has piloted these waters for fifty years under both flags, shrugs.',
      say('manolis', '“The sea is the same sea. Choose the paymaster you can live with.”'),
    ],
    venice: 'Sail for Venice', ottoman: 'Sail for the Porte',
  },
  // one line under each leg's title, on the card before the fight
  legs: {
    'Home waters': { both: 'One brig, one harbour, and nobody else to send.' },
    'The run': { both: 'A powder ship does not want a long conversation. Candia’s walls are in sight, and so is the patrol.' },
    'The anchorage': { both: 'Powder for a month of siege, in one hull, waiting for dark.' },
    'The brothers': { both: 'They have hunted as a pair since they were boys.' },
    'A lee shore': { both: 'Nobody sensible is at sea today. Kara Osman is.' },
    'The careenage': { both: 'Half her people are ashore scraping weed. For now.' },
    'The landing': { both: 'The village bell is ringing.' },
    'Among the islets': { both: 'Despina had a daughter.' },
    'False colours': { both: 'A borrowed flag, a steady course, and a straight face.' },
    'Dead calm': { both: 'Dawn, and the sails hang like washing.' },
    'Up the strait': { both: 'Two castles, one current, and all of it against you. Then the same way back.' },
    'The flagship': { both: 'Everything so far has been for this.' },
    'Down the strait': { both: 'The current is with you. It will not let you change your mind.' },
    'The mole': { both: 'The day of the assault.' },
    'The harbour': { both: 'Smoke, and every ship for herself.' },
    'The sortie': { both: 'The day of the assault.' },
  },
  // what each pirate captain says a few seconds into the fight, shown with their face. Start each line with the
  // name portraits.js knows them by (speakerOf).
  taunts: {
    mags: ['Despina: “Only the wine, captain. Keep your chapel.”'],
    kastor: ['Kastor: “You take the left one, brother.”'],
    polydeukes: ['Polydeukes: “I always take the left one.”'],
    varga: ['Kara Osman: “Good weather for it.”'],
    yusra: ['Kızıl Ayşe: “Get the boats back! Cut the cable if you have to!”'],
    thorne: ['Lazaros: “Finish ashore. I will deal with this one.”'],
    daughter: ['Eleni: “My mother taught me these rocks. Who taught you?”'],
    korrigan: ['Murad: “Come alongside, friend, and tell me the news.”'],
  },
  // the rival from Powder for Candia hails you a few seconds into Dead calm, by the side you serve
  rivals: { [V]: 'İbrahim Reis: “Now we find out.”', [O]: 'Barbaro: “I said I would remember.”' },
  officers: {
    pilot: { [V]: { name: 'Old Manolis, the pilot', line: 'He has piloted these waters for fifty years and sees no reason to stop.' }, [O]: { name: 'Old Manolis, the pilot', line: 'He has piloted these waters for fifty years and sees no reason to stop.' } },
    carpenter: { [V]: { name: 'Mastro Piero, the carpenter', line: 'A shipwright from the Arsenal, sent out to Suda and bored there.' }, [O]: { name: 'Usta Kemal, the carpenter', line: 'A shipwright from the yards at Galata, sent out to Chania and bored there.' } },
    gunner: { [V]: { name: 'Marousa, the gunner', line: 'She laid guns for three pirate captains and outlived all of them. She would rather be paid regularly.' }, [O]: { name: 'Marousa, the gunner', line: 'She laid guns for three pirate captains and outlived all of them. She would rather be paid regularly.' } },
    marines: { [V]: { name: 'Captain Zuanne Barbaro', line: '' }, [O]: { name: 'İbrahim Reis', line: '' } },
  },

  m0: {
    [V]: { end: { title: 'Suda', text: [
      'The fortress of Suda sits on an island in the mouth of its bay, with Ottoman Crete all round it and the lion of St Mark over the gate. They paint the same lion on your sails before you have finished your first cup of wine.',
    ] } },
    [O]: { end: { title: 'Chania', text: [
      'Chania was Venetian until the first summer of the war. Now the fleet lies in its harbour under the red flag, and the old arsenals build galleys for the Sultan. They paint the crescent on your sails before you have finished your first cup of coffee.',
    ] } },
  },

  m1: {
    [V]: {
      brief: { title: 'Powder for Candia', text: [
        'Candia has held for twenty years because ships keep reaching it. Suda keeps them coming.',
        'Captain Zuanne Barbaro has a cargo and no ship fit to carry it: powder, enough for a month of the city’s guns.',
        say('barbaro', '“İbrahim Reis keeps a patrol off the harbour, and he is good at it. They will see you coming. There is shoal water inshore of them, if your ship is small enough to use it.”'),
        say('barbaro', '“How you get the powder in is your affair. Getting it in is the Republic’s.”'),
      ] },
      end: { title: 'The powder is landed', text: [
        'The city’s boats come out before your anchor is down, and the barrels go ashore by lantern. On the walls above, the guns that were being rationed fire through the night.',
        'In the morning a boat brings a note in a neat hand, with no signature.',
        say('ibrahim', '<i>You are either lucky or good. I will find out which.</i>'),
        say('manolis', '“That is how İbrahim Reis writes.”'),
      ] },
    },
    [O]: {
      brief: { title: 'Powder for Candia', text: [
        'From Chania the army before Candia is fed and the sea around it watched. The siege goes on because ships keep reaching the city.',
        'İbrahim Reis commands the patrol and has news.',
        say('ibrahim', '“The <i>Santa Caterina</i>, a powder ship, under a captain named Barbaro. She has put into a cove down the coast to wait for dark, under a small battery. One guard ship outside.”'),
        say('ibrahim', '“If that powder reaches the city, the siege is a month longer. Take her, burn her or sink her. I do not mind which.”'),
      ] },
      end: { title: 'The powder never arrives', text: [
        'By morning the whole coast knows. On the walls of Candia the guns go back to counted rounds.',
        'A prisoner exchange brings a note in a firm, angry hand, signed Zuanne Barbaro.',
        say('barbaro', '<i>That was my ship. I will remember yours.</i>'),
      ] },
    },
  },

  m2: {
    [V]: {
      brief: { title: 'Independent command', text: [
        'A war is good weather for pirates. With both fleets busy off Crete, the Cyclades fill with island captains who serve nobody and take the Republic’s ships and the Sultan’s alike.',
        'Ser Alvise brings you a commission from the Provveditore, and no instructions worth the name.',
        say('recruiter', '“Clear them out. Three have been reported this month; which three you find will depend on the wind.”'),
        say('recruiter', '“Anything you take is yours to keep, and to sail.”'),
      ] },
      legs: [
        { pause: ['Manolis: “One. They will hear of it on every island by tomorrow, and the others will be ready or gone.”'] },
        { pause: ['The carpenter has opinions about what the last one did to his planking, and shares them.', 'One more.'] },
        {},
      ],
      end: { title: 'Quiet in the Cyclades', text: [
        'For the first time in years a grain ship reaches Suda from the north without an escort. Nobody remarks on it, which is the point.',
      ] },
    },
    [O]: {
      brief: { title: 'Independent command', text: [
        'A war is good weather for pirates. With both fleets busy off Crete, the Cyclades fill with island captains who serve nobody and take the Sultan’s ships and the Republic’s alike.',
        'Hüseyin Efendi gives you a commission and no instructions worth the name.',
        say('secretary', '“The islands pay their tax to be kept safe; keep them safe. Three pirates have been reported this month; which three you find will depend on the wind.”'),
        say('secretary', '“Anything you take is yours to keep, and to sail.”'),
      ] },
      legs: [
        { pause: ['Manolis: “One. They will hear of it on every island by tomorrow, and the others will be ready or gone.”'] },
        { pause: ['The carpenter has opinions about what the last one did to his planking, and shares them.', 'One more.'] },
        {},
      ],
      end: { title: 'Quiet in the Cyclades', text: [
        'For the first time in years a grain ship reaches Chania from the north without an escort. Nobody remarks on it, which is the point.',
      ] },
    },
  },

  m3: {
    [V]: {
      brief: { title: 'The calm', text: [
        'In summer the wind dies before dawn and comes back with the sun, and in between the sea belongs to anything with oars. Galleys know this. They have known it for two thousand years.',
        'You are to meet a supply ship south of the cape. The meeting place is a day’s row from Chania, and İbrahim Reis can count as well as you can.',
        'Marousa has been chalking ranges on the gun carriages.',
        say('marousa', '“If the wind fails, we are a fort. Forts can win, if they are patient.”'),
      ] },
      end: { title: 'After the calm', text: [
        'Among the men pulled from the water is Zuanne Barbaro, in the rags of a red coat. He took the next powder run in himself and never arrived; since then he has pulled an oar in the galley you fought. He looks at your ship for some time.',
        say('barbaro', '“I have had a whole season to think about what I would do with a deck under me again.”'),
      ] },
    },
    [O]: {
      brief: { title: 'The calm', text: [
        'In summer the wind dies before dawn and comes back with the sun, and in between the sea belongs to anything with oars. Galleys know this. They have known it for two thousand years.',
        'You are to carry dispatches round the cape. The Venetians at Suda keep galleys of their own, a day’s row from your course, and Captain Barbaro can count as well as you can.',
        'Marousa has been chalking ranges on the gun carriages.',
        say('marousa', '“If the wind fails, we are a fort. Forts can win, if they are patient.”'),
      ] },
      end: { title: 'After the calm', text: [
        'İbrahim Reis comes aboard at Chania, without his patrol. Two of his ships were lost off Candia while you were at sea, and the Kapudan Pasha has given what is left to another man.',
        say('ibrahim', '“I am a captain without a deck. You have a deck, and you keep winning on it. Let me bring my men.”'),
      ] },
    },
  },

  m4: {
    [V]: {
      brief: { title: 'The straits', text: [
        'The Republic cannot beat the Sultan’s army on Crete, so it has gone to the door the army is fed through. A Venetian fleet lies off the mouth of the Dardanelles, a week’s sail from Candia, and everything bound for Crete must come out past it.',
        'Ser Alvise has come out with the dispatch boat.',
        say('recruiter', '“The Captain General has word of a great ship fitting out above the castles: a flagship for a fleet meant to break the blockade. She is not ready. In a month she will be.”'),
        say('manolis', '“Going up is slow. Coming down is fast, and you cannot take it back.”'),
      ] },
      end: { title: 'Below the castles', text: [
        'The fleet at the mouth sees the smoke before it sees you. The fleet that was to break the blockade has no flagship, and whatever reaches Crete this year will be less than was meant.',
        'Then the dispatch boat from Candia comes in. The Grand Vizier himself has taken command of the siege, and he does not mean to wait another year.',
      ] },
    },
    [O]: {
      brief: { title: 'The straits', text: [
        'The Venetians cannot beat the army on Crete, so they have gone to the door it is fed through. Their fleet lies off the mouth of the Dardanelles, and for months nothing has come out: no powder, no bread, no men.',
        'Hüseyin Efendi has come up from Chania with the orders, and reads them to you himself.',
        say('secretary', '“The fleet in the strait is not ready to fight its way out. It does not need to. Two ships are anchored across the channel at the mouth, and they are the blockade.”'),
        say('secretary', '“One of them will do. Take her, burn her, or frighten her off her anchor, and the convoys can run.”'),
        say('manolis', '“Going down is fast, and you cannot take it back. Only the eddies inshore will carry you up again.”'),
      ] },
      end: { title: 'The door opens', text: [
        'Three nights later the first convoy goes out past the castles on the current, and the Venetians are too few to stop it. What reaches Crete this year will be all that was meant.',
        'Then the dispatch boat comes down from the capital. The Grand Vizier himself is going to Crete to end the siege, and he wants every ship.',
      ] },
    },
  },

  m5: {
    [V]: {
      brief: { title: 'Candia', note: 'No port between fights today: whatever ship you take out is the ship you have, with whatever you can capture.', text: [
        'More than twenty years. Children born in Candia during the siege have children of their own. The walls are rubble held together by habit, and the Captain General, Francesco Morosini, has perhaps one fight left in his garrison.',
        'The Grand Vizier knows it. At dawn his army goes at the walls and his fleet at the harbour, because if the harbour falls the city starves in a week.',
        say('morosini', '“The city has one more day in it. So have I. Keep the harbour open until dark.”'),
      ] },
      legs: [
        { pause: ['The mole still stands. Behind you the harbour is filling with smoke as the two fleets come together.', 'Barbaro, reloading: “Pick one. Any one. They are all the right one today.”'] },
        { pause: ['The harbour is yours for the moment.', 'Marousa: “The guns are hot. Give them a minute and something to shoot at.”', 'Then Manolis touches your arm and points seaward.', 'A great ship under a green and red standard, standing in alone. The fortress fires and the shot falls short: half its guns are dismounted.'] },
        {},
      ],
    },
    [O]: {
      brief: { title: 'Candia', note: 'No port between fights today: whatever ship you take out is the ship you have, with whatever you can capture.', text: [
        'More than twenty years. Men who dug the first trenches before Candia have sons in the trenches now. The Grand Vizier, Köprülü Fazıl Ahmed, has come in person to finish it, and at dawn the army goes at the walls.',
        'The fleet goes at the harbour in the same hour: while it stays open, the city can be fed for ever. At the mouth stand the sea fortress and the battery on the mole.',
        say('vizier', '“Twenty years. I mean to be home before the winter.”'),
      ] },
      legs: [
        { pause: ['The mole battery is quiet. Through the gap the harbour is filling with smoke as the two fleets come together.', 'İbrahim Reis, reloading: “Pick one. Any one. They are all the right one today.”'] },
        { pause: ['The harbour is yours for the moment.', 'Marousa: “The guns are hot. Give them a minute and something to shoot at.”', 'Then Manolis touches your arm and points.', 'A great ship with the lion at her mainmast, warping out from under the fortress to fight in the last clear water there is.'] },
        {},
      ],
    },
  },

  ending: {
    [V]: { eyebrow: 'Candia', title: 'The city holds', text: [
      'With the harbour open, the relief ships come in on the evening wind, and the assault on the walls breaks against men who know they will eat tomorrow. Within the month the Grand Vizier’s engineers are filling in their own trenches.',
      say('morosini', 'The Republic strikes a medal for the defenders of Candia. It honours only Venetians, so your name is not on it. Morosini sends for you anyway, and gives you the flag the <i>Agia Marina</i> flew in the harbour, scorched through, with the lion still on it.'),
      say('barbaro', '“The historians will have the medal. Everyone on those walls will remember whose ship flew that flag.”'),
      'Then you sail for Lychna: one harbour, forty houses and a chapel. The flag goes in a chest under the wine. The goatherd’s boy still keeps watch from the ridge. He has not seen a black hull in a long time.',
    ] },
    [O]: { eyebrow: 'Kandiye', title: 'The city falls', text: [
      'With the harbour closed, Morosini asks for terms within the week. The garrison may sail away with its arms and banners, the people with what they can carry. After more than twenty years the keys change hands without another shot.',
      say('vizier', 'The Grand Vizier sends a robe of honour: green silk, gold thread, and sleeves that reach past your fingers.'),
      say('ibrahim', '“It suits you. Wear it on Lychna and the goats will think the Sultan has come.”'),
      'Then you sail for Lychna: one harbour, forty houses and a chapel. The robe goes in a chest under the wine. The goatherd’s boy still keeps watch from the ridge. He has not seen a black hull in a long time.',
    ] },
    note: 'In history Candia was surrendered on terms in September 1669, after a siege of more than twenty years. Venice kept the island fortresses of Suda, Spinalonga and Gramvousa.',
  },
};
