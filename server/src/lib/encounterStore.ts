export type EncounterState = {
  id: string;
  userId: string;
  areaId: string;
  speciesId: string;
  level: number;
  currentHp: number;
  maxHp: number;
  fledUntil?: number;
};

const encounters = new Map<string, EncounterState>();

export const putEncounter = (e: EncounterState) => encounters.set(e.id, e);
export const getEncounter = (id: string) => encounters.get(id);
export const removeEncounter = (id: string) => encounters.delete(id);
