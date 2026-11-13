# Broadside: the Candia campaign

A story campaign set in the Cretan War (1645–1669). You are an Aegean island captain who takes
a commission with Venice or with the Ottoman fleet, and the campaign ends in the harbour of
Candia, where your side wins the siege if you win the fight.

The campaign follows the shape of the war and compresses its length: the fight to supply
Crete, the blockade of the Dardanelles, the end at Candia. No years are shown on screen. (The
real blockade was fought in the 1650s and the city fell in 1669.)

Status: implemented. This document is the design as proposed; the section "As built" at the end
lists where the game differs from it and what the research pass could and could not confirm.

## Decisions already made

- Real war, invented captain. Real places and commanders appear in the background; you, your
  officers and your rivals are invented. The Venetian ending departs from history (Candia fell
  in 1669).
- Two endings, one per side. Failing any mission means retrying it; the story never branches.
- A short campaign: a prologue and five missions per side.
- Missions set a goal and never a method.
- Progress is a wider choice of ships and a few officers, never a bigger ship.
- The player serves a state, never raids civilians, and galley rowers are simply "oarsmen".

## Design rules

1. **A mission is a goal plus a situation.** "Get four of six supply ships into Candia" is a
   mission. "Board the flagship" is not. Every mission must be winnable in at least three
   clearly different ways, by different kinds of ship, and the harness checks this.
2. **Size is a trade.** Big ships need crew you may not have, cannot enter shoal water, and
   are helpless in a calm against oars. No mission is gated on tonnage.
3. **Fittings belong to a ship; officers belong to you.** This is the existing fittings rule,
   extended.
4. **The player holds the initiative.** No mission ties you to slow ships you do not control.
   If a cargo has to get through, you are sailing it.
5. **No mission is won by one quality alone.** Running is always allowed and never the only
   answer. Each mission lists a route for a heavy ship, a nimble one and an oared or boarding
   one, and none has a clock that only speed can beat. Time pressure changes the situation
   (the wind fills in, the garrison turns out) instead of ending the mission.
6. **Mirror the story, not always the fight.** Both sides live through the same events, but
   each gets the active seat. Where the other end of a fight would be passive, that side plays
   a different fight in the same episode.
7. **One ship, few opponents.** You command one ship at a time, always. Prizes are sailed
   clear by a prize crew and do not fight beside you. Fights are one against one to one
   against three. The single exception is the harbour in the finale, where other ships fight
   each other in pairs as background.
8. **The story is told in the gaps.** Briefing in port, a few lines in each pause at sea, a
   closing scene. Text only, in keeping with a game that has no asset files.

## Structure

A mission is a **cruise**: two or three fights ("legs") with no port between them. Hull, sails,
crew and shot carry from one leg to the next.

Between legs you get a **jury-rig pause** with three watches to spend. Each watch does one of:

| Watch | Effect (starting numbers) |
| --- | --- |
| Patch the hull | +15% hull, up to 70% |
| Splice the rigging | +25% sails, up to 80% |
| Tend the wounded | A third of the crew lost in the last leg return |
| Strip a prize | Take her shot and some of her hands |
| Shift your flag | Take command of a ship captured this cruise |

Sea repairs are capped, so damage still matters, but a bad first leg is not the end of the
mission. Failing a leg lets you retry it from the state you entered it in, or restart the mission.

Port sits between missions: full repairs, fittings, shot, and the choice of which ship to take.
That choice is fixed once you sail. For the rest of the mission you have that ship and any
prizes you board along the way: prizes stay with you, you can shift your flag between them at
any pause, and those that survive join your stable in port.
Venice's home port is Suda; the Ottoman one is Chania. Both reuse the existing harbour.

## The campaign

| # | Episode | Venetian mission | Ottoman mission | Mirror |
| --- | --- | --- | --- | --- |
| 0 | **Home waters** | Keep a pirate off your island's harbour | Same | Shared |
| 1 | **Powder for Candia** | Run the powder ship into the city through the patrol | Deal with the powder ship at her anchorage before she sails | Story |
| 2 | **Independent command** | Clear the pirates from the Cyclades | Same | Shared |
| 3 | **The calm** | Galleys come out at dawn in a dead calm; the wind is coming | Same, under the other flag | Fight |
| 4 | **The straits** | Go up the Dardanelles and destroy the flagship fitting out above the castles | Come down the Dardanelles and break the blockade at its mouth | Story |
| 5 | **Candia** | The defence of the harbour on the day of the assault | The assault | Story |

Each mission below lists three routes, to show it is not a one-answer problem. They are
examples, not the only ways through.

**0. Home waters.** One fight, in your own trading brig. It is the tutorial and it reuses the
existing coaching. Afterwards both powers offer a commission, and you choose in the story.
It is always played: it is short, and it is where the story starts.

**1. Powder for Candia.** The same powder ship and the same rival captain appear in both
stories; in each, your side wins.

- *Venice: the run.* You carry the powder in your own ship. Two patrol ships lie between you
  and the harbour, with shoals inshore. Heavy: fight through; the mission is also won if the
  patrol is beaten. Nimble: take the shoal channel and let a deeper ship run aground after
  you. Boarder: take a patrol ship and sail in under her colours.
- *Ottomans: the anchorage.* The powder ship lies in a cove under a small battery, waiting
  for dark. Take her, burn her or draw her out. Heavy: silence the battery and batter her.
  Nimble: come in through the battery's dead ground and set her alight with heated shot.
  Boarder: cut her out and sail her home as a prize.

**2. Independent command.** Three fights drawn at random from a pool of about six pirate
scenarios, with a jury-rig pause between each. The pool reuses the five existing pirate
captains and the cheaper archetypes: two galliots working together, a duel on a lee shore in
a gale, a pirate at anchor in a cove, a pirate landing on a village, a ship hiding among islets, a pirate who can be
approached under false colours. This is the experiment with roguelike play, and the chapter
where most players will fill their stable.

**3. The calm.** A true mirror, because both ends are active. At dawn there is no wind and
enemy galleys come out to fight; the wind fills in during the battle and brings an enemy
sailing ship with it. In a sailing ship you must live through the calm and then turn on them.
In a galley you meet them oar to oar and try to finish before the wind arrives. Heavy:
anchor on a spring, hold them off with grape and wait for the breeze. Nimble: use every
cat's-paw of wind to keep your broadside on their bows. Oared: fight them on their own terms.

**4. The straits.** Venice carries the war to the enemy's door by blockading the Dardanelles.
It is the furthest the story goes from Crete, and it reverses the roles: Venice is the
attacker far from home and the Ottomans fight in their own water. Whoever wins here decides
what force reaches Candia, which sets up the finale.

The strait has its own rule: a **current** runs out to sea, strongest in mid-channel, with
slack water and back-eddies inshore, where the shoals and the castle guns are. The wind
usually blows the same way. Going up is slow and coming down is fast and hard to undo.

- *Venice: up the straits.* A new Ottoman flagship is fitting out above the castles with one
  guard ship. Destroy or take her, then get out. Heavy: fight up the middle and trade shots
  with a castle. Nimble: creep up the inshore eddies among the shoals and burn her with
  heated shot. Oared or boarder: cut her out and ride the current home.
- *Ottomans: down the straits.* Two Venetian ships lie anchored across the mouth. Break the
  blockade: take, sink or burn one, or force her to cut her cable and drift off station.
  Heavy: anchor upstream of her and out-shoot her. Nimble: sweep past her bows, rake, and
  work back up the eddies for another pass. Boarder: let the current carry you onto her.
  Anyone: set a prize alight and let the current take it down onto an anchored ship.

There is no raid mission. The prologue already shows a raid from the defender's side, one
scenario in the pirate pool is a pirate landing on a village, and the officers can say in
passing that both fleets license the same thing.

**5. Candia.** Three fights without port on the day of the final assault, around the Koules,
the sea fortress at the harbour mouth. As in every mission, you fight it with the ship you
chose and whatever you capture on the day.

- *Ottomans: the assault.* (1) The mouth: get in under the fortress guns and silence a
  battery or fire its magazine, by any means. (2) The harbour: a melee, with the rest of both
  fleets paired off around you; choose where to weigh in. (3) The flagship: a duel in
  confined water, with the fort's arcs drawn on the water.
- *Venice: the defence.* (1) The sortie: go out and break up the fireships and bomb vessels
  leading the assault before they reach the mole. (2) The harbour: the same melee. (3) The
  flagship: the Ottoman commander comes in, and you fight him under your own failing guns.

The background battle is affordable because each pair of ships simply runs the existing duel
AI against each other.

## Ships, oars and wind

The existing five hulls are re-dressed for the period: sloop, brig, xebec, a hired armed
merchantman (the frigate) and a flagship (the galleon).

**Galleys** are the new kind of ship: heavy guns firing forward, weak sides, a large crew.

- They are nearly independent of the wind. Only a gale troubles them.
- Oars run on **stamina**: sprinting drains it and lying still refills it. Losing crew cuts
  oar power, so grapeshot has a second use against them.
- Start with one galley. Ships are built from numbers, so a small galliot and a Venetian
  galleass (oars and broadside guns, slow under both) can follow if playtests want them.

**Wind strength** is set per fight and can change during it: calm, breeze or gale. It
governs speed and momentum under sail, and a gale spoils everyone's gunnery.

**Current.** Used in the straits: a steady drift that every ship feels, varying across the
channel.

**Shoals and grounding.** Shallow water is marked, and a ship that draws too much sticks
there until she works herself off. The AI can be lured aground, and so can you.

## Officers

Four on each side, earned at fixed points in the story. They are permanent, follow you from
ship to ship, and each one bends a rule instead of raising a number.

| Officer | Joins after | What changes |
| --- | --- | --- |
| The pilot, from your island | Prologue (both sides) | Shoals are marked on the water and wind shifts are called before they arrive |
| The carpenter | Mission 1 | A fourth watch in every pause |
| The gunner, a former pirate | Mission 2 (both sides) | Change shot without losing the load |
| The captain of marines | Mission 3 | Shift your flag to a prize without spending a watch, and she arrives fully crewed |

The marine captain is the mirror: on each side they are the rival you fought in mission 1 on
the other. They are also the voices in the pauses.

## What the engine needs

Today a battle is exactly one player and one enemy. The campaign needs, in build order:

1. **Missions with several ships.** A list of ships with sides, goals other than "destroy her",
   legs with carried state, and the pause screen. This is the largest single piece of work.
2. **AI for more than a duel.** Choosing targets, working in pairs, coping with shoals and forts.
3. **Wind strength, oars with stamina and forward guns.**
4. **Fixed things.** Shore batteries with drawn arcs, anchored ships, shoals and grounding, current.
   A background battle of paired duels for the finale.
5. **Campaign state.** Saved progress, the stable, officers, colours and flags for each side.
6. **Harness.** Run whole missions, and report which approaches win, so no mission has a
   single answer.

## Milestones

1. **Slice:** prologue and mission 1 as Venice, with the jury-rig pause. Proves several ships,
   legs and a goal that is not a duel.
2. **Oars:** wind strength and galleys; mission 3; the Ottoman side of mission 1.
3. **Command:** the pirate pool for mission 2.
4. **Endgame:** the straits (current, castles) and the finale.
5. **Story:** officers, text, balance.

The existing five-pirate ladder stays playable as a skirmish mode.

## Risks

- **Several ships on a phone.** Every model is built in code; four to eight ships with crews
  need a performance check in the first milestone.
- **AI in shoal water.** Luring a ship aground must feel earned, not like an AI bug.
- **Two missions per story episode.** Story mirrors cost more than fight mirrors: episodes 1,
  4 and 5 each need two fights built.
- **A bad state at the start of a leg.** Retrying a leg you entered half-wrecked may be
  hopeless. Restarting the mission is the fallback; the repair caps may need raising.
- **Tone.** Both sides need equal dignity in the writing, and the omissions listed above
  need to be kept consistently.

## As built

Where the game differs from the proposal above, and why.

- **Hands.** "Big ships need crew you may not have" is a number: your ship's company grows from 80
  to 150 hands over the campaign, and a ship with more berths than you have hands sails
  short-handed (slower loading, weaker in a boarding). Oarsmen come with an oared ship. Marines
  fitted to a ship are extra.
- **Galleys pound before they board.** An AI galley takes station off the bow or stern of a ship
  that cannot move and uses her bow guns; she boards only once the odds are well in her favour.
  The harness showed that galleys which boarded at once made the calm a coin-toss on crew size.
- **The calm is two legs.** The galleys in the calm (a galley and a galliot), then, after a pause,
  the sailing ship the breeze brings, with whatever is left of the galleys.
- **Mission 5, Venice.** The assault is led by fireships only. Bomb vessels are an anachronism for
  1669 (they first appear in the 1680s).
- **Prizes.** A prize of a kind you do not own joins your ships in port; one of a kind you already
  own is sold. The fleet also lends you a ship after each mission (sloop, xebec, galley, armed
  merchantman) so every route is open to a player who has captured nothing.
- **The burning-prize route in the straits** ("set a prize alight and let the current take it down")
  is not built. Fire does spread between hulls that foul each other.
- **Storming a battery** is a boarding action against its garrison, so "by any means" includes it.
- **Ships under AI do not board each other.** Only your deck is fought over; the background battle
  in the finale is settled with guns.
- **Touch.** New actions have buttons, but the campaign was built and tuned for the keyboard.

### What the harness checks

`tools/balance/legs.mjs` plays every leg with six hulls along each of that leg's scripted routes,
and `legreport.mjs` flags any leg that fewer than three kinds of ship or fewer than three routes can
win. The scripted captains are competent, not clever: 0% means "not with this script".

### History: what the text relies on

The research pass could read search summaries but not full source pages, so the text keeps to
claims that were confirmed there and stays vague elsewhere. No years appear on screen.

Relied on, confirmed: the Ottoman landing on Crete and the fall of Chania at the start of the war;
Candia besieged for more than twenty years; a Venetian blockade of the Dardanelles in the 1650s;
Venice holding the island fortresses of Suda, Spinalonga and Gramvousa; hired Dutch and English
ships in Venetian service; Francesco Morosini commanding at the end and surrendering on terms to
the Grand Vizier, Köprülü Fazıl Ahmed, in September 1669, the garrison and people being allowed to
leave.

Used but not confirmed from a full source, worth checking: that the sea fortress at Candia was
called Rocca a Mare by the Venetians and Su Kulesi (Water Tower) by the Ottomans; the names
Kilitbahir and Kale-i Sultaniye for the two castles at the Narrows; the direction of the current and
the summer wind in the strait; that Ottoman galleys were known by their captains' names; the
Venetian ending's "medal". Everything about Lychna, its captain, Manolis, Marousa, Barbaro and
İbrahim Reis is invented, as are all ship names.
