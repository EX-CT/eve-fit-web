import type { Character, DamagePattern, TargetProfile } from '../fit/model';

export const BUILTIN_CHARACTERS: Character[] = [
  { id: 'all5', name: 'All 5', default_level: 5, levels: {}, builtin: true },
  { id: 'all4', name: 'All 4', default_level: 4, levels: {}, builtin: true },
  { id: 'all0', name: 'All 0', default_level: 0, levels: {}, builtin: true },
];

// Common damage patterns (percent shares; only the ratio matters).
export const BUILTIN_DAMAGE: DamagePattern[] = [
  { id: 'uniform', name: 'Uniform', em: 25, thermal: 25, kinetic: 25, explosive: 25, builtin: true },
  { id: 'em', name: 'EM', em: 100, thermal: 0, kinetic: 0, explosive: 0, builtin: true },
  { id: 'thermal', name: 'Thermal', em: 0, thermal: 100, kinetic: 0, explosive: 0, builtin: true },
  { id: 'kinetic', name: 'Kinetic', em: 0, thermal: 0, kinetic: 100, explosive: 0, builtin: true },
  { id: 'explosive', name: 'Explosive', em: 0, thermal: 0, kinetic: 0, explosive: 100, builtin: true },
  { id: 'em-therm', name: 'EM/Thermal (lasers)', em: 55, thermal: 45, kinetic: 0, explosive: 0, builtin: true },
  { id: 'therm-kin', name: 'Thermal/Kinetic (hybrids)', em: 0, thermal: 45, kinetic: 55, explosive: 0, builtin: true },
  { id: 'kin-exp', name: 'Kinetic/Explosive (projectiles)', em: 0, thermal: 0, kinetic: 40, explosive: 60, builtin: true },
  { id: 'npc-guristas', name: 'NPC: Guristas', em: 0, thermal: 18, kinetic: 82, explosive: 0, builtin: true },
  { id: 'npc-serpentis', name: 'NPC: Serpentis', em: 0, thermal: 45, kinetic: 55, explosive: 0, builtin: true },
  { id: 'npc-blood', name: 'NPC: Blood Raiders', em: 50, thermal: 50, kinetic: 0, explosive: 0, builtin: true },
  { id: 'npc-sansha', name: 'NPC: Sansha', em: 53, thermal: 47, kinetic: 0, explosive: 0, builtin: true },
  { id: 'npc-angel', name: 'NPC: Angel Cartel', em: 7, thermal: 2, kinetic: 22, explosive: 69, builtin: true },
  { id: 'npc-drones', name: 'NPC: Rogue Drones', em: 0, thermal: 0, kinetic: 50, explosive: 50, builtin: true },
  { id: 'npc-triglavian', name: 'NPC: Triglavian', em: 0, thermal: 61, kinetic: 0, explosive: 39, builtin: true },
];

export const BUILTIN_TARGETS: TargetProfile[] = [
  { id: 'none', name: 'No target (ideal)', em: 0, thermal: 0, kinetic: 0, explosive: 0, builtin: true },
  { id: 'frigate', name: 'Frigate (35 m, 400 m/s)', em: 0, thermal: 0, kinetic: 0, explosive: 0, signature_radius: 35, max_velocity: 400, radius: 40, builtin: true },
  { id: 'cruiser', name: 'Cruiser (125 m, 250 m/s)', em: 0, thermal: 0, kinetic: 0, explosive: 0, signature_radius: 125, max_velocity: 250, radius: 150, builtin: true },
  { id: 'battleship', name: 'Battleship (400 m, 100 m/s)', em: 0, thermal: 0, kinetic: 0, explosive: 0, signature_radius: 400, max_velocity: 100, radius: 400, builtin: true },
  { id: 'uniform-50', name: 'Uniform 50% resists', em: 0.5, thermal: 0.5, kinetic: 0.5, explosive: 0.5, signature_radius: 125, max_velocity: 200, radius: 150, builtin: true },
];
