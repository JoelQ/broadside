// All of the campaign's words. No code reads meaning from this file: change any line freely.
//
// The war is real; you, your officers and your rivals are invented. Real things kept in the
// background: Venice held Candia through a siege of more than twenty years; the Ottomans took
// Chania at the start of the war; Venice blockaded the Dardanelles in the 1650s; the island
// fortress of Suda stayed Venetian; Candia was surrendered in September 1669 by Francesco
// Morosini to the Grand Vizier, Köprülü Fazıl Ahmed. The Venetian ending here departs from that.
// No years are shown on screen.

export const SIDE_NAME = { venice: 'Venice', ottoman: 'the Ottoman fleet' };
export const PORTS = { island: 'Lychna', venice: 'Suda', ottoman: 'Chania' };

// Ship names. NAMES.venice are Venetian ships (met as enemies when you serve the Porte, lent to
// you when you serve Venice), and the other way about. Ottoman galleys were known by their
// captains, so theirs carry a captain's name.
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
export const STORY = {
  opening: {
    eyebrow: 'Lychna, in the Aegean', title: 'Home waters',
    text: [
      'Lychna is a rock with one harbour, forty houses and a chapel. It pays its tax to the Sultan and sells its wine to whoever calls. The <i>Agia Marina</i> is the island’s brig and you are her captain, which mostly means carrying wine and counting barrels.',
      'There is a war on. Two summers ago the Sultan’s army landed on Crete, and now the Venetians are shut up in the great city of Candia with the sea at their backs. On Lychna the war has meant higher prices and fewer honest ships.',
      'This morning the goatherd’s boy ran down from the ridge. A sail to the south, black-hulled, standing in for the harbour, and nobody on the island owns a black hull.',
    ],
    go: 'Clear for action',
  },
  choice: {
    title: 'Two offers',
    text: [
      'A fight off a small island is news for a week. Before the week was out two boats had called at Lychna.',
      'The first carried a Venetian officer from the fortress of Suda, in a red coat, with a purse and a paper. The Republic is hiring ships to keep Candia alive, he said, and a captain who can fight a brig like that should not be carrying wine.',
      'The second carried a quiet man from the Kapudan Pasha’s fleet at Chania, with a paper of his own. The Sultan’s fleet has need of captains who know these islands, he said, and Lychna is the Sultan’s island, after all.',
      'Old Manolis, who has piloted these waters for fifty years and served under both flags, shrugged. “The sea is the same sea. Choose the paymaster you can live with.”',
    ],
    venice: 'Sail for Venice', ottoman: 'Sail for the Porte',
  },
  // one line under each leg's title, on the card before the fight
  legs: {
    'Home waters': { both: 'Forty houses and a chapel, and nobody else to send.' },
    'The picket': { both: 'A powder ship does not want a long conversation.' },
    'The patrol': { both: 'Candia’s walls are in sight. So are they.' },
    'The guard ship': { both: 'She sits where the channel narrows, as she should.' },
    'The anchorage': { both: 'Powder for a month of siege, in one hull, waiting for dark.' },
    'The brothers': { both: 'They have hunted as a pair since they were boys.' },
    'A lee shore': { both: 'Nobody sensible is at sea today. Varga is.' },
    'The careenage': { both: 'Half her people are ashore scraping weed. For now.' },
    'The landing': { both: 'The village bell is ringing.' },
    'Among the islets': { both: 'She learned these rocks from her mother.' },
    'False colours': { both: 'A borrowed flag, a steady course, and a straight face.' },
    'Dead calm': { both: 'Dawn, and the sails hang like washing.' },
    'The breeze': { both: 'Now it is a sailor’s fight.' },
    'The castles': { both: 'Two castles, one current, and all of it against you.' },
    'The flagship': { both: 'Everything so far has been for this.' },
    'The watch galley': { both: 'The current is with you. It will not let you change your mind.' },
    'The blockade': { both: 'Two ships at anchor have shut the fleet in. Open the door.' },
    'The mole': { both: 'The day of the assault.' },
    'The harbour': { both: 'Smoke, and every ship for herself.' },
    'The sortie': { both: 'The day of the assault.' },
  },
  officers: {
    pilot: { [V]: { name: 'Old Manolis, the pilot', line: '“Somebody has to tell you where the rocks are.”' }, [O]: { name: 'Old Manolis, the pilot', line: '“Somebody has to tell you where the rocks are.”' } },
    carpenter: { [V]: { name: 'Mastro Piero, the carpenter', line: 'A shipwright from the Arsenal, sent out to Suda and bored there.' }, [O]: { name: 'Usta Kemal, the carpenter', line: 'A shipwright from the yards at Galata, sent out to Chania and bored there.' } },
    gunner: { [V]: { name: 'Marousa, the gunner', line: 'She laid guns for three pirate captains and outlived all of them. She would rather be paid regularly.' }, [O]: { name: 'Marousa, the gunner', line: 'She laid guns for three pirate captains and outlived all of them. She would rather be paid regularly.' } },
    marines: { [V]: { name: 'Captain Zuanne Barbaro', line: 'He lost the <i>Santa Caterina</i>’s sister to these same waters and has asked to serve where the fighting is.' }, [O]: { name: 'İbrahim Reis', line: 'He has chased powder ships off Candia for three years. He would rather sail with someone who catches them.' } },
  },

  m0: {
    [V]: { end: { title: 'Suda', text: [
      'The fortress of Suda sits on an island in the mouth of its bay, with Ottoman Crete all round it and the lion of St Mark over the gate. They paint the same lion on your sails before you have finished your first cup of wine.',
      'Manolis comes with you. He says it is to see that the <i>Agia Marina</i> is looked after.',
    ] } },
    [O]: { end: { title: 'Chania', text: [
      'Chania was Venetian until the first summer of the war. Now the fleet lies in its harbour under the red flag, and the old arsenals build galleys for the Sultan. They paint the crescent on your sails before you have finished your first cup of coffee.',
      'Manolis comes with you. He says it is to see that the <i>Agia Marina</i> is looked after.',
    ] } },
  },

  m1: {
    [V]: {
      brief: { title: 'Powder for Candia', text: [
        'Suda is an island fortress in the mouth of a long bay, and it is one of the last places on Crete where the Lion of St Mark still flies. Candia is the other that matters. The city has held for years because ships keep reaching it.',
        'Captain Zuanne Barbaro has a cargo and no ship fit to carry it: powder, enough for a month of the city’s guns. “İbrahim Reis keeps a patrol off the harbour, and he is good at it. They will see you coming. There is shoal water inshore of them, if your ship is small enough to use it.”',
        'How you get the powder in is your affair. Getting it in is the Republic’s.',
      ] },
      legs: [
        { pause: ['Manolis: “That was the picket. The patrol proper lies off the harbour: a hired ship with heavy guns and a brig. Both draw more water than a sloop.”', 'The powder rides quietly in the hold. Nobody smokes.'] },
        {},
      ],
      end: { title: 'The powder is landed', text: [
        'The city’s boats come out before your anchor is down, and the barrels go ashore by lantern. On the walls above, the guns that were being rationed fire through the night.',
        'In the morning a boat brings a note in a neat hand, with no signature. <i>You are either lucky or good. I will find out which.</i> Manolis says it is how İbrahim Reis writes.',
      ] },
    },
    [O]: {
      brief: { title: 'Powder for Candia', text: [
        'Chania was the first city of Crete to fall, and it is the fleet’s harbour now. From here the army before Candia is fed, and from here the sea around the city is watched. The siege goes on because ships keep reaching Candia.',
        'İbrahim Reis commands the patrol and has news. “The <i>Santa Caterina</i>, a powder ship, under a captain named Barbaro. She has put into a cove down the coast to wait for dark, under a small battery. One guard ship outside. If that powder reaches the city, the siege is a month longer.”',
        'Take her, burn her or sink her. He does not mind which.',
      ] },
      legs: [
        { pause: ['Manolis: “The cove is past the next headland. The battery is on the western point and looks south-west. It was built to stop ships coming the obvious way.”', 'The light is going. She will sail when it is gone.'] },
        {},
      ],
      end: { title: 'The powder never arrives', text: [
        'By morning the whole coast knows. On the walls of Candia the guns go back to counted rounds.',
        'A prisoner exchange brings a note in a firm, angry hand. <i>That was my ship. I will remember yours.</i> It is signed Zuanne Barbaro.',
      ] },
    },
  },

  m2: {
    [V]: {
      brief: { title: 'Independent command', text: [
        'A war is good weather for pirates. With both fleets busy off Crete, the Cyclades have filled with captains who serve nobody: renegades, deserters, and a few who were simply here first. They take the Republic’s supply ships and the Sultan’s alike.',
        'The Provveditore gives you a commission and no instructions worth the name. Clear them out. Three have been reported this month; which three you find will depend on the wind.',
        'Anything you take is yours to keep, and to sail.',
      ] },
      legs: [
        { pause: ['Manolis: “One. They will hear of it on every island by tomorrow, and the others will be ready or gone.”'] },
        { pause: ['The carpenter has opinions about what the last one did to his planking, and shares them.', 'One more.'] },
        {},
      ],
      end: { title: 'Quiet in the Cyclades', text: [
        'For the first time in two years a grain ship reaches Suda from the north without an escort. Nobody remarks on it, which is the point.',
      ] },
    },
    [O]: {
      brief: { title: 'Independent command', text: [
        'A war is good weather for pirates. With both fleets busy off Crete, the Cyclades have filled with captains who serve nobody: renegades, deserters, and a few who were simply here first. They take the Sultan’s supply ships and the Republic’s alike.',
        'The Kapudan Pasha’s secretary gives you a commission and no instructions worth the name. The islands pay their tax to be kept safe; keep them safe. Three pirates have been reported this month; which three you find will depend on the wind.',
        'Anything you take is yours to keep, and to sail.',
      ] },
      legs: [
        { pause: ['Manolis: “One. They will hear of it on every island by tomorrow, and the others will be ready or gone.”'] },
        { pause: ['The carpenter has opinions about what the last one did to his planking, and shares them.', 'One more.'] },
        {},
      ],
      end: { title: 'Quiet in the Cyclades', text: [
        'For the first time in two years a grain ship reaches Chania from the north without an escort. Nobody remarks on it, which is the point.',
      ] },
    },
  },

  m3: {
    [V]: {
      brief: { title: 'The calm', text: [
        'In summer the wind dies before dawn and comes back with the sun, and in between the sea belongs to anything with oars. Galleys know this. They have known it for two thousand years.',
        'You are to meet a supply ship south of the cape. The meeting place is a day’s row from Chania, and İbrahim Reis can count as well as you can.',
        'Marousa has been chalking ranges on the gun carriages. “If the wind fails,” she says, “we are a fort. Forts can win, if they are patient.”',
      ] },
      legs: [
        { pause: ['The galleys haul off as the breeze comes: they have no wish to meet a sailing ship that can move.', 'Manolis points north-east. A tall ship, hull down, coming with the wind behind her. “They sent a friend.”'] },
        {},
      ],
      end: { title: 'After the calm', text: [
        'Among the men pulled from the water is a Venetian in the rags of a red coat: Zuanne Barbaro, taken off Candia a year ago and chained to an oar in the galley you fought. He looks at your ship for some time.',
        '“I have had a year to think about what I would do with a deck under me again.”',
      ] },
    },
    [O]: {
      brief: { title: 'The calm', text: [
        'In summer the wind dies before dawn and comes back with the sun, and in between the sea belongs to anything with oars. Galleys know this. They have known it for two thousand years.',
        'You are to carry dispatches round the cape. The Venetians at Suda keep galleys of their own, a day’s row from your course, and Captain Barbaro can count as well as you can.',
        'Marousa has been chalking ranges on the gun carriages. “If the wind fails,” she says, “we are a fort. Forts can win, if they are patient.”',
      ] },
      legs: [
        { pause: ['The galleys haul off as the breeze comes: they have no wish to meet a sailing ship that can move.', 'Manolis points north-east. A tall ship, hull down, coming with the wind behind her. “They sent a friend.”'] },
        {},
      ],
      end: { title: 'After the calm', text: [
        'İbrahim Reis comes aboard at Chania, without his patrol. Two of his ships were lost off Candia while you were at sea, and the Kapudan Pasha has given what is left to another man.',
        '“I am a captain without a deck. You have a deck, and you keep winning on it. Let me bring my men.”',
      ] },
    },
  },

  m4: {
    [V]: {
      brief: { title: 'The straits', text: [
        'The Republic cannot beat the Sultan’s army on Crete, so it has gone to the door the army is fed through. A Venetian fleet lies off the mouth of the Dardanelles, a week’s sail from Candia, and everything bound for Crete must come out past it.',
        'Now the Captain General has word of a great ship fitting out above the castles: a flagship for a fleet meant to break the blockade. She is not ready. In a month she will be.',
        'The current in the strait runs out to sea, hard in mid-channel and slack along the shores, and the summer wind blows the same way. “Going up is slow,” says Manolis. “Coming down is fast, and you cannot take it back.”',
      ] },
      legs: [
        { pause: ['Above the castles the strait opens. Barbaro has been watching the far shore through a glass. “There. Yards down on deck, lighters alongside. And one guard ship, awake.”', 'Whatever is done to her, the way home is the way you came.'] },
        {},
      ],
      end: { title: 'Below the castles', text: [
        'The fleet at the mouth sees the smoke before it sees you. The fleet that was to break the blockade has no flagship, and whatever reaches Crete this year will be less than was meant.',
        'Then the dispatch boat from Candia comes in. The Grand Vizier himself has taken command of the siege, and he does not mean to wait another year.',
      ] },
    },
    [O]: {
      brief: { title: 'The straits', text: [
        'The Venetians cannot beat the army on Crete, so they have gone to the door it is fed through. Their fleet lies off the mouth of the Dardanelles, and for months nothing has come out: no powder, no bread, no men.',
        'The fleet in the strait is not ready to fight its way out. It does not need to. Two ships are anchored across the channel at the mouth, and they are the blockade. Take one, sink one, burn one, or frighten one into cutting her cable, and the convoys can run.',
        'The current runs out to sea, hard in mid-channel and slack along the shores, and the summer wind blows the same way. “Going down is fast,” says Manolis, “and you cannot take it back. Only the eddies inshore will carry you up again.”',
      ] },
      legs: [
        { pause: ['Past the last bend the strait opens to the sea, and there they are: two ships, bows upstream, lying to their anchors as if they owned the water.', 'İbrahim Reis: “They cannot run. Remember that neither can we.”'] },
        {},
      ],
      end: { title: 'The door opens', text: [
        'Three nights later the first convoy goes out past the castles on the current, and the Venetians are too few to stop it. What reaches Crete this year will be all that was meant.',
        'Then the dispatch boat comes down from the capital. The Grand Vizier himself is going to Crete to end the siege, and he wants every ship.',
      ] },
    },
  },

  m5: {
    [V]: {
      brief: { title: 'Candia', text: [
        'More than twenty years. Children born in Candia during the siege have children of their own. The walls are rubble held together by habit, and the Captain General, Francesco Morosini, has perhaps one fight left in his garrison.',
        'The Grand Vizier knows it. His army will go at the walls at dawn, and his fleet will come for the harbour at the same hour, because if the harbour goes the city starves in a week. At the harbour mouth stands the Rocca a Mare, the sea fortress, with the lion carved over its gate.',
        'There will be no port between fights today. Whatever ship you take out is the ship you have, with whatever you can capture.',
      ] },
      legs: [
        { pause: ['The mole still stands. Behind you the harbour is filling with smoke as the two fleets come together.', 'Barbaro, reloading: “Pick one. Any one. They are all the right one today.”'] },
        { pause: ['The harbour is yours for the moment. Then Manolis touches your arm and points seaward.', 'A great ship under a green and red standard, standing in alone. The fortress fires and the shot falls short: half its guns are dismounted.'] },
        {},
      ],
    },
    [O]: {
      brief: { title: 'Candia', text: [
        'More than twenty years. Men who dug the first trenches before Candia have sons in the trenches now. The Grand Vizier, Köprülü Fazıl Ahmed, has come in person to finish it, and at dawn the army goes at the walls.',
        'The fleet goes at the harbour in the same hour, because while the harbour is open the city can be fed for ever. At the harbour mouth stands the sea fortress the Venetians call Rocca a Mare and the army calls the Water Tower, and beside it the battery on the mole.',
        'There will be no port between fights today. Whatever ship you take out is the ship you have, with whatever you can capture.',
      ] },
      legs: [
        { pause: ['The mole battery is quiet. Through the gap the harbour is filling with smoke as the two fleets come together.', 'İbrahim Reis, reloading: “Pick one. Any one. They are all the right one today.”'] },
        { pause: ['The harbour is yours for the moment. Then Manolis touches your arm and points.', 'A great ship with the lion at her mainmast, warping out from under the fortress to fight in the last clear water there is.'] },
        {},
      ],
    },
  },

  ending: {
    [V]: { eyebrow: 'Candia', title: 'The city holds', text: [
      'With the harbour open, the relief ships come in on the evening wind, and the assault on the walls breaks against men who know they will eat tomorrow. Within the month the Grand Vizier’s engineers are filling in their own trenches.',
      'The Republic strikes a medal. Your name is not on it, because you are not Venetian, but Morosini sends for you and says what the medal does not.',
      'Then you sail for Lychna, which is a rock with one harbour, forty houses and a chapel, and where nobody owns a black hull.',
    ] },
    [O]: { eyebrow: 'Kandiye', title: 'The city falls', text: [
      'With the harbour closed, Morosini asks for terms within the week, and the Grand Vizier grants them: the garrison may sail away with its arms and its banners, and the people with what they can carry. After more than twenty years the keys are handed over without another shot.',
      'The Grand Vizier sends a robe of honour. İbrahim Reis says it suits you, and that you should not wear it on Lychna.',
      'Then you sail for home, which is a rock with one harbour, forty houses and a chapel, and where nobody owns a black hull.',
    ] },
    note: 'In history Candia was surrendered on terms in September 1669, after a siege of more than twenty years. Venice kept the island fortresses of Suda, Spinalonga and Gramvousa.',
  },
};
