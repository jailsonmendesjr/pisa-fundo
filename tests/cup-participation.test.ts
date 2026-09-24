import assert from "node:assert/strict";
import test from "node:test";
import { buildCupParticipation } from "../lib/cup-participation.ts";
import type {
  CupScoringParticipant,
  CupScoringResult,
} from "../lib/cup-scoring.ts";

const participant: CupScoringParticipant = {
  entryId: 10,
  driverId: 20,
  driverName: "Piloto Teste",
  teamName: "Equipe Teste",
  teamColor: "#000000",
  carNumber: 7,
  firstRoundId: 102,
};

const rounds = [
  { roundId: 101, cupOrder: 1, roundName: "Etapa 1" },
  { roundId: 102, cupOrder: 2, roundName: "Etapa 2" },
  { roundId: 103, cupOrder: 3, roundName: "Etapa 3" },
];

test("sempre cria quatro indicadores e preserva etapas ainda não cadastradas", () => {
  const markers = buildCupParticipation(rounds, participant, [], []);

  assert.equal(markers.length, 4);
  assert.equal(markers[0].state, "NOT_ENROLLED");
  assert.equal(markers[1].state, "PENDING");
  assert.equal(markers[3].state, "PENDING");
  assert.equal(markers[3].roundId, null);
});

test("distingue participação, abandono, DNS e ausência", () => {
  const results: CupScoringResult[] = [
    { roundId: 102, entryId: 10, points: 10, position: 2, status: "COMPLETED" },
    { roundId: 103, entryId: 10, points: 0, position: 0, status: "DNF" },
  ];
  const markers = buildCupParticipation(
    rounds,
    participant,
    results,
    [101, 102, 103]
  );

  assert.equal(markers[0].state, "NOT_ENROLLED");
  assert.equal(markers[1].state, "PARTICIPATED");
  assert.equal(markers[2].state, "PARTICIPATED");

  const dnsMarkers = buildCupParticipation(
    rounds,
    participant,
    [{ roundId: 102, entryId: 10, points: 0, position: 0, status: "DNS" }],
    [101, 102, 103]
  );
  assert.equal(dnsMarkers[1].state, "MISSED");
  assert.equal(dnsMarkers[2].state, "MISSED");
});
