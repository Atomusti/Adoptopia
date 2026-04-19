export interface Position {
  x: number;
  y: number;
}

export interface Animal {
  id: string;
  name: string;
  species: "cat" | "dog" | "rabbit";
  emoji: string;
  quirk: string;
  allergyRisk: boolean;
  noiseLevel: number;
  energyLevel: number;
}

export interface Family {
  id: string;
  name: string;
  emoji: string;
  gridPosition: Position;
  hasAllergy: boolean;
  noiseLimit: number;
  energyMatch: number;
}

export const SHELTER_POSITION: Position = { x: 4, y: 4 };
export const GRID_SIZE = 10;
export const MAX_FUEL = 56;

export const gameData: { animals: Animal[]; families: Family[] } = {
  animals: [
    {
      id: "a1",
      name: "Monsieur Whiskers",
      species: "cat",
      emoji: "😼",
      quirk: "Meows only in a thick French accent",
      allergyRisk: true,
      noiseLevel: 4,
      energyLevel: 2
    },
    {
      id: "a2",
      name: "DJ Bork",
      species: "dog",
      emoji: "🐶",
      quirk: "Barks in perfect rhythm to any music playing",
      allergyRisk: false,
      noiseLevel: 5,
      energyLevel: 5
    },
    {
      id: "a3",
      name: "Señor Fluffington",
      species: "rabbit",
      emoji: "🐰",
      quirk: "Dramatically faints when ignored for more than 5 minutes",
      allergyRisk: false,
      noiseLevel: 1,
      energyLevel: 3
    },
    {
      id: "a4",
      name: "Agent Paws",
      species: "cat",
      emoji: "😸",
      quirk: "Tries to assassinate laser pointers using martial arts",
      allergyRisk: true,
      noiseLevel: 2,
      energyLevel: 4
    },
    {
      id: "a5",
      name: "Count Barkula",
      species: "dog",
      emoji: "🐕",
      quirk: "Exclusively demands kibble at exactly midnight",
      allergyRisk: true,
      noiseLevel: 3,
      energyLevel: 2
    },
    {
      id: "a6",
      name: "Sir Hops-a-Lot",
      species: "rabbit",
      emoji: "🐇",
      quirk: "Solves quantum mechanics problems by twitching his nose",
      allergyRisk: false,
      noiseLevel: 1,
      energyLevel: 5
    },
    {
      id: "a7",
      name: "Captain Noodles",
      species: "dog",
      emoji: "🐩",
      quirk: "Believes he is completely invisible when he closes his eyes",
      allergyRisk: false,
      noiseLevel: 4,
      energyLevel: 4
    },
    {
      id: "a8",
      name: "Madam Purrfect",
      species: "cat",
      emoji: "😽",
      quirk: "Harshly judges your fashion choices with aggressive blinking",
      allergyRisk: true,
      noiseLevel: 2,
      energyLevel: 1
    }
  ],
  families: [
    { id: "f1", name: "The Smiths", emoji: "🏡", gridPosition: { x: 1, y: 1 }, hasAllergy: false, noiseLimit: 4, energyMatch: 5 },
    { id: "f2", name: "The Johnsons", emoji: "🏠", gridPosition: { x: 8, y: 2 }, hasAllergy: true, noiseLimit: 2, energyMatch: 2 },
    { id: "f3", name: "The Williams", emoji: "🏘️", gridPosition: { x: 2, y: 8 }, hasAllergy: false, noiseLimit: 5, energyMatch: 4 },
    { id: "f4", name: "The Browns", emoji: "🏚️", gridPosition: { x: 9, y: 9 }, hasAllergy: false, noiseLimit: 1, energyMatch: 3 },
    { id: "f5", name: "The Garcias", emoji: "🛖", gridPosition: { x: 5, y: 1 }, hasAllergy: true, noiseLimit: 3, energyMatch: 2 },
    { id: "f6", name: "The Millers", emoji: "⛺", gridPosition: { x: 0, y: 5 }, hasAllergy: false, noiseLimit: 4, energyMatch: 5 },
    { id: "f7", name: "The Davis", emoji: "🏰", gridPosition: { x: 8, y: 7 }, hasAllergy: true, noiseLimit: 2, energyMatch: 4 },
    { id: "f8", name: "The Martinez", emoji: "🏯", gridPosition: { x: 3, y: 3 }, hasAllergy: false, noiseLimit: 5, energyMatch: 1 }
  ]
};
