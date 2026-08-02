// The game's sound set — now a mapping into the 8bit-sfx library rather
// than a hand-rolled synth table.
//
// v0.15: the 28 sounds this game grew are published in 8bit-sfx as its
// `rpg` category (rendered by an exact port of the engine this file used to
// carry), so the definitions live there and the game just names them. That
// also opens the library's 202 procedural RPG effects to us — which is where
// the spells, the turn-based stingers, and the potion glugs come from.
//
// Every value is an 8bit-sfx effect name. `gain` rides on top per event so
// the mix stays the game's own.

/** event name -> { name: 8bit-sfx effect, gain } */
export const SOUNDS = {
  // Movement — barely-there ticks at stride cadence.
  'step-person': { name: 'rpg_step-person', gain: 0.5 },
  'step-dog': { name: 'rpg_step-dog', gain: 0.4 },

  // Talking.
  caption: { name: 'rpg_caption', gain: 0.5 },
  whimper: { name: 'rpg_whimper', gain: 0.7 },

  // Menus.
  'menu-open': { name: 'rpg_menu-open', gain: 0.8 },
  'menu-move': { name: 'rpg_menu-move', gain: 0.5 },
  'menu-confirm': { name: 'rpg_menu-confirm', gain: 0.7 },

  // The dice.
  roll: { name: 'rpg_roll', gain: 0.7 },

  // Hurting and mending.
  damage: { name: 'rpg_damage', gain: 1 },
  heal: { name: 'rpg_heal', gain: 0.8 },
  collapse: { name: 'rpg_collapse', gain: 1 },

  // Being two creatures.
  swap: { name: 'rpg_swap', gain: 0.7 },

  // Fetch.
  throw: { name: 'rpg_throw', gain: 0.7 },
  pickup: { name: 'rpg_pickup', gain: 0.7 },
  deliver: { name: 'rpg_deliver', gain: 0.8 },

  // Story beats.
  meet: { name: 'rpg_meet', gain: 1 },
  inflatables: { name: 'rpg_inflatables', gain: 0.8 },
  genie: { name: 'rpg_genie', gain: 0.9 },
  vision: { name: 'rpg_vision', gain: 0.8 },
  vanish: { name: 'rpg_vanish', gain: 0.6 },

  // The undead and the equipment for dealing with them.
  zombie: { name: 'rpg_zombie', gain: 0.9 },
  bonk: { name: 'rpg_bonk', gain: 1 },
  eat: { name: 'rpg_eat', gain: 0.7 },
  drunk: { name: 'rpg_drunk', gain: 0.8 },

  // Growth.
  xp: { name: 'rpg_xp', gain: 0.6 },
  levelup: { name: 'rpg_levelup', gain: 1 },

  // The mansion.
  door: { name: 'rpg_door', gain: 0.9 },
  clock: { name: 'rpg_clock', gain: 0.5 },

  // v0.15 — drawn from the library's procedural RPG set.
  'battle-start': { name: 'rpg_017', gain: 1 }, // the world goes turn-based
  'battle-end': { name: 'rpg_035', gain: 0.9 }, // ...and lets go again
  turn: { name: 'rpg_006', gain: 0.5 }, // your move
  'spell-learn': { name: 'rpg_061', gain: 1 }, // the leaf teaches you something
  'spell-cast': { name: 'rpg_058', gain: 0.9 },
  'spell-fail': { name: 'rpg_072', gain: 0.7 },
  ward: { name: 'rpg_049', gain: 0.9 },
};

/** Every event name the game can emit. main.js plays these 1:1. */
export const EVENT_NAMES = Object.keys(SOUNDS);
