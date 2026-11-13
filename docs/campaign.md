# Broadside: the Candia campaign (proposal)

A story campaign set in the last years of the Cretan War (1667–1669). You are an Aegean island
captain who takes a commission with Venice or with the Ottoman fleet, and the campaign ends in the
harbour of Candia, where your side wins the siege if you win the fight.

Status: proposal. Numbers are starting points for the balance harness, and historical details
need a research pass before any text is written.

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
4. **The story is told in the gaps.** Briefing in port, a few lines in each pause at sea, a
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
Venice's home port is Suda; the Ottoman one is Chania. Both reuse the existing harbour.

## The campaign

| # | Mission | Venetian goal | Ottoman goal |
| --- | --- | --- | --- |
| 0 | **Home waters** (shared prologue) | A pirate comes for your island's harbour. Keep her off the anchored boats. | Same |
| 1 | **Powder for Candia** (mirrored) | Escort a supply convoy into the city | Stop that convoy |
| 2 | **Independent command** (shared, random) | Clear the pirates from the Cyclades | Same |
| 3 | **The Chania run** (mirrored) | Stop the army's supply ships reaching Chania | Bring them in past the Suda patrol |
| 4 | **The raid** (exclusive) | Corsairs under Ottoman colours descend on Tinos. Hold them off until the garrison turns out. | Knights' galleys descend on an Ottoman island town. Same. |
| 5 | **Candia** (mirrored finale) | Force the relief fleet through to the city | Turn it back |

**0. Home waters.** One leg, in your own trading brig. It is the tutorial and it reuses the
existing coaching. Afterwards both powers offer a commission, and you choose in the story.
Replays can skip straight to the choice.

**1. Powder for Candia.** Open sea, a steady breeze, slow merchantmen. Leg one is a scout
shadowing the convoy; if she gets away, the attack in leg two comes from upwind. The escort can
fight, screen or lead the attackers off. The attacker can take the escort, cripple the
merchantmen, or cut one out and run.

**2. Independent command.** Three legs drawn at random from a pool of about six pirate
scenarios, with a jury-rig pause between each. The pool reuses the five existing pirate
captains. Examples: a pirate anchored in a cove under a shore battery; two galliots hunting
together in a calm; a pirate chasing a merchantman; a captured ship being sailed home by a
prize crew; a lure into shoal water. This is the experiment with roguelike play, and the
chapter where most players will fill their stable.

**3. The Chania run.** Deliberately unlike mission 1: narrow water, a fort, light and shifting
wind, and galleys on both sides. Timing and wind matter more than weight of shot.

**4. The raid.** The one mission that is not mirrored, so that nobody plays the raider. There
are more raiders than you can stop, and the goal is time, not kills. The briefing admits that
your own admirals license the same thing.

**5. Candia.** Three legs without port: the blockade line outside the bay, the roadstead under
the guns of the walls, and the enemy commander's ship. Each is a goal with no prescribed
method. Your whole stable sails with you in reserve, and at each pause you may shift your flag
to another of your ships. Captures made through the campaign therefore become your options
and your second chances in the finale.

## Ships

The existing five hulls are re-dressed for the period: sloop, brig, xebec, a hired armed
merchantman (the frigate) and a flagship (the galleon). Three oared types are new:

| Ship | Character |
| --- | --- |
| Galliot | Small, fast under oars, a few light guns, a pirate's favourite |
| Galley | Heavy guns firing forward, weak sides, a large crew, ignores the wind, suffers in a blow |
| Galleass | A Venetian speciality: broadside guns and oars, slow under both |

Galleys need two new rules: **wind strength** per leg (calm, breeze, gale) and **guns that
fire ahead**. The existing sweeps fitting is the starting point for oars.

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
2. **AI for more than a duel.** Choosing targets, escorting, merchantmen that flee.
3. **Wind strength, oars and forward guns.**
4. **Fixed things.** Shore batteries, anchored ships, shoals and draught.
5. **Campaign state.** Saved progress, the stable, officers, colours and flags for each side.
6. **Harness.** Run whole missions, and report which approaches win, so no mission has a
   single answer.

## Milestones

1. **Slice:** prologue and mission 1 as Venice, with the jury-rig pause. Proves several ships,
   legs and a goal that is not a duel.
2. **Oars:** wind strength and galleys; mission 3; the Ottoman side of missions 1 and 3.
3. **Command:** the pirate pool for mission 2.
4. **Endgame:** the raid and the finale, with the reserve squadron.
5. **Story:** officers, text, balance.

The existing five-pirate ladder stays playable as a skirmish mode.

## Risks

- **Several ships on a phone.** Every model is built in code; four to eight ships with crews
  need a performance check in the first milestone.
- **Convoy and escort AI.** Easy to make dull or exploitable; the slice exists to find out.
- **A bad state at the start of a leg.** Retrying a leg you entered half-wrecked may be
  hopeless. Restarting the mission is the fallback; the repair caps may need raising.
- **Tone.** Both sides need equal dignity in the writing, and the omissions listed above
  need to be kept consistently.
